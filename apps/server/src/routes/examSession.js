import { Router } from "express";
import ExamSessionModel from "../models/ExamSession.js";
import ExamTemplateModel from "../models/ExamTemplate.js";
import StudentExamCodeModel from "../models/StudentExamCode.js";
import StudentSubmissionModel from "../models/StudentSubmission.js";
import UserModel from "../models/User.js";
import ClassroomModel from "../models/Classroom.js";
import { isAuthenticated } from "../middleware/middlewareAuth.js";
import { isLecturerOrAdmin } from "../middleware/isLecturerOrAdmin.js";
import { normalizeEmails } from "../services/studentEmail.js";

const examSessionRouter = Router();

/**
 * Resolve the MongoDB user document for the current request.
 *
 * Prefers `req.dbUser` (loaded by the policy middleware via `googleId`),
 * but falls back to looking the user up directly so that routes which use
 * only `isAuthenticated` (and the legacy passport mocks in tests) still work.
 *
 * `req.user` from `deserializeUser` is the MongoDB document itself, so
 * `req.user.id` is the Mongoose virtual getter for `_id` — NOT the googleId
 * string. Looking the user up by that `_id` as a `googleId` always returns
 * `null`, which used to crash routes that did `user.role` directly.
 */
async function resolveCurrentUser(req) {
  if (req.dbUser) return req.dbUser;
  const googleId =
    req.user?.googleId ||
    (typeof req.user?.id === "string" ? req.user.id : undefined);
  if (!googleId) return null;
  return UserModel.findOne({ googleId });
}

// --- SSE Setup ---
export const sseClients = new Map();

export const notifySessionUpdate = (sessionId) => {
  const clients = sseClients.get(sessionId.toString());
  if (clients) {
    clients.forEach((client) => {
      client.write(`data: ${JSON.stringify({ type: "UPDATE" })}\n\n`);
    });
  }
};
// -----------------

// Helper: resolve student emails from classroomIds
async function resolveClassroomEmails(classroomIds) {
  if (!classroomIds || classroomIds.length === 0) return [];
  const classrooms = await ClassroomModel.find({ _id: { $in: classroomIds } });
  const emails = [];
  for (const classroom of classrooms) {
    for (const studentId of classroom.students) {
      const email = `${studentId.trim()}@student.tdtu.edu.vn`;
      if (!emails.includes(email)) emails.push(email);
    }
  }
  return emails;
}

// SSE Endpoint for realtime updates (Lecturer only)
examSessionRouter.get("/:id/live", isAuthenticated, isLecturerOrAdmin, (req, res) => {
  const sessionId = req.params.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Send initial connected message
  res.write(`data: ${JSON.stringify({ type: "CONNECTED" })}\n\n`);

  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId).add(res);

  req.on("close", () => {
    const clients = sseClients.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(sessionId);
      }
    }
  });
});

/**
 * @swagger
 * /exam-sessions:
 *   post:
 *     summary: Create new exam session (Lecturer only)
 *     tags: [Exam Sessions]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - examTemplateId
 *               - sessionName
 *               - accessKey
 *               - startTime
 *               - endTime
 *             properties:
 *               examTemplateId:
 *                 type: string
 *               sessionName:
 *                 type: string
 *               accessKey:
 *                 type: string
 *               whitelist:
 *                 type: array
 *                 items:
 *                   type: string
 *               blacklist:
 *                 type: array
 *                 items:
 *                   type: string
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/ExamSession'
 *       404:
 *         description: Template not found
 */
// Create new exam session from template (Lecturer only)
examSessionRouter.post("/", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
  try {
    const {
      examTemplateId,
      sessionName,
      accessKey,
      whitelist,
      blacklist,
      startTime,
      endTime,
      classroomIds,
      entryMode,
    } = req.body;

    // Verify template exists
    const template = await ExamTemplateModel.findById(examTemplateId);
    if (!template) {
      return res.status(404).json({ error: "Exam template not found" });
    }

    // Validate required fields
    if (!sessionName || !accessKey || !startTime || !endTime) {
      return res.status(400).json({
        error:
          "Missing required fields: sessionName, accessKey, startTime, endTime",
      });
    }

    // Helper: Normalize student IDs to full emails
    const newWhitelist = normalizeEmails(whitelist);
    const newBlacklist = normalizeEmails(blacklist);

    // roomCode will be auto-generated by schema default
    const newSession = await ExamSessionModel.create({
      examTemplateId,
      sessionName,
      accessKey,
      whitelist: newWhitelist,
      blacklist: newBlacklist,
      classroomIds: classroomIds || [],
      entryMode: entryMode || "approval",
      startTime,
      endTime,
      createdBy: req.dbUser._id,
    });

    res.status(201).json({ session: newSession });
  } catch (error) {
    console.error("Error creating exam session:", error);

    // Handle duplicate roomCode (very rare but possible)
    if (error.code === 11000 && error.keyPattern?.roomCode) {
      return res.status(500).json({
        error: "Failed to generate unique room code. Please try again.",
      });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /exam-sessions:
 *   get:
 *     summary: Get all exam sessions created by current lecturer
 *     tags: [Exam Sessions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of exam sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExamSession'
 */
// Get all sessions (created by current lecturer)
examSessionRouter.get("/", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
  try {
    const sessions = await ExamSessionModel.find({ createdBy: req.dbUser._id })
      .populate("examTemplateId", "templateName examType language duration")
      .sort({ startTime: -1 })
      .lean();

    const sessionIds = sessions.map((s) => s._id);
    const submissions = await StudentSubmissionModel.aggregate([
      { $match: { examSessionId: { $in: sessionIds }, isSubmitted: true } },
      { $group: { _id: "$examSessionId", count: { $sum: 1 } } },
    ]);

    const submissionCountMap = submissions.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.count;
      return acc;
    }, {});

    const sessionsWithCount = sessions.map((session) => {
      session.submittedCount = submissionCountMap[session._id.toString()] || 0;
      return session;
    });

    res.json({ sessions: sessionsWithCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /exam-sessions/search/by-roomcode/{roomCode}:
 *   get:
 *     summary: Search exam session by room code (for students)
 *     tags: [Exam Sessions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Room code
 *     responses:
 *       200:
 *         description: Session found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 session:
 *                   $ref: '#/components/schemas/ExamSession'
 *                 isAvailable:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Session not found
 */
// Search session by room code (for students)
examSessionRouter.get(
  "/search/by-roomcode/:roomCode",
  isAuthenticated,
  async (req, res) => {
    try {
      const { roomCode } = req.params;

      const session = await ExamSessionModel.findOne({
        roomCode: roomCode.toUpperCase(),
      })
        .populate("examTemplateId", "templateName examType language duration")
        .populate("createdBy", "name email")
        .select("-accessKey"); // Don't expose access key

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found with this room code" });
      }

      // Check if session is available for joining
      const now = new Date();
      const isAvailable =
        session.status === "ongoing" && now < new Date(session.endTime);

      // Check if this student already has a computerOrder for this session
      const user = await resolveCurrentUser(req);
      let hasComputerOrder = false;
      if (user) {
        const existingCode = await StudentExamCodeModel.findOne({
          examSessionId: session._id,
          studentId: user._id,
        });
        hasComputerOrder = existingCode?.computerOrder != null;
        // Also check waiting list
        if (!hasComputerOrder) {
          const waitingEntry = session.waitingList?.find(
            (entry) => entry.userId?.toString() === user._id.toString(),
          );
          hasComputerOrder = waitingEntry?.computerOrder != null;
        }
      }

      const sessionObj = session.toObject();
      sessionObj.hasComputerOrder = hasComputerOrder;

      res.json({
        session: sessionObj,
        isAvailable,
        message: isAvailable ? null : "This session is no longer available",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * @swagger
 * /exam-sessions/available:
 *   get:
 *     summary: Get available exam sessions for students
 *     tags: [Exam Sessions]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of available sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExamSession'
 *       403:
 *         description: Student only endpoint
 */
// Get available exam sessions for students (Student only)
examSessionRouter.get("/available", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);

    if (!user || user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    const now = new Date();

    // Get sessions that are scheduled or ongoing and not yet ended
    const sessions = await ExamSessionModel.find({
      status: { $in: ["scheduled", "ongoing"] },
      endTime: { $gte: now },
    })
      .populate("examTemplateId", "templateName examType language duration")
      .populate("createdBy", "name email") // Populate teacher info
      .select("-accessKey") // Don't expose access key
      .sort({ startTime: 1 });

    // Filter based on whitelist/blacklist
    const availableSessions = sessions.filter((session) => {
      // Check blacklist
      if (session.blacklist.includes(user.email)) {
        return false;
      }

      // Check if user is in waitingList
      const inWaitingList =
        session.waitingList &&
        session.waitingList.some(
          (item) =>
            item.userId?.toString() === user._id.toString() ||
            item.toString() === user._id.toString(),
        );

      // Check whitelist
      const inWhitelist = session.whitelist.includes(user.email);

      return inWaitingList || inWhitelist;
    });
    // Fetch submissions to check isSubmitted flags
    const sessionIds = availableSessions.map((s) => s._id);
    const submissions = await StudentSubmissionModel.find({
      studentId: user._id,
      examSessionId: { $in: sessionIds },
    });

    // Fetch existing exam code records for this student across all sessions
    const studentExamCodes = await StudentExamCodeModel.find({
      studentId: user._id,
      examSessionId: { $in: sessionIds },
    });

    // Format response to include isPending flag
    const formattedSessions = availableSessions.map((session) => {
      const sessionObj = session.toObject();
      const inWaitingList =
        session.waitingList &&
        session.waitingList.some(
          (item) =>
            item.userId?.toString() === user._id.toString() ||
            item.toString() === user._id.toString(),
        );
      const userSubmission = submissions.find(
        (sub) => sub.examSessionId.toString() === session._id.toString(),
      );
      const existingCode = studentExamCodes.find(
        (sc) => sc.examSessionId.toString() === session._id.toString(),
      );
      return {
        ...sessionObj,
        isPending: inWaitingList,
        isSubmitted: userSubmission ? userSubmission.isSubmitted : false,
        hasComputerOrder: existingCode?.computerOrder != null,
      };
    });

    res.json({ sessions: formattedSessions });
  } catch (error) {
    console.error("Error getting available sessions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Join exam session (Student - validate access key)
examSessionRouter.post("/:id/join", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);

    if (!user || user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    const { accessKey } = req.body;

    if (!accessKey || !accessKey.trim()) {
      return res.status(400).json({ error: "Access key is required" });
    }

    const session = await ExamSessionModel.findById(req.params.id).populate(
      "examTemplateId",
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Validate access key
    if (session.accessKey !== accessKey) {
      return res.status(403).json({ error: "Invalid access key" });
    }

    // Check whitelist/blacklist
    if (session.blacklist.includes(user.email)) {
      return res
        .status(403)
        .json({ error: "You are blacklisted from this exam" });
    }

    if (
      session.whitelist.length > 0 &&
      !session.whitelist.includes(user.email)
    ) {
      return res
        .status(403)
        .json({ error: "You are not whitelisted for this exam" });
    }

    // Check time
    const now = new Date();
    if (session.status === "scheduled") {
      return res.status(400).json({ error: "Exam has not started yet" });
    }
    if (now > new Date(session.endTime)) {
      return res.status(400).json({ error: "Exam has ended" });
    }

    res.json({
      success: true,
      message: "Access granted",
      session: {
        _id: session._id,
        sessionName: session.sessionName,
        roomCode: session.roomCode,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
      },
    });
  } catch (error) {
    console.error("Error joining session:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get session details
examSessionRouter.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);

    let session;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (user.role === "lecturer") {
      session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: user._id,
      }).populate("examTemplateId");
    } else if (user.isSuperAdmin || user.role === "admin") {
      // Super-admins / admins can inspect any session (e.g. via lecturer URLs).
      session = await ExamSessionModel.findById(req.params.id)
        .populate("examTemplateId");
    } else {
      session = await ExamSessionModel.findById(req.params.id)
        .populate("examTemplateId")
        .select("-accessKey");
    }

    if (!session) {
      return res
        .status(404)
        .json({ error: "Session not found or access denied" });
    }

    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update session settings (Lecturer only, scheduled or ongoing)
examSessionRouter.put("/:id", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
  try {
    const session = await ExamSessionModel.findOne({
      _id: req.params.id,
      createdBy: req.dbUser._id,
    });

    if (!session) {
      return res
        .status(404)
        .json({ error: "Session not found or access denied" });
    }

    if (session.status !== "scheduled" && session.status !== "ongoing") {
      return res
        .status(400)
        .json({ error: "Cannot update session that has ended" });
    }

    // Helper: Normalize student IDs to full emails
    const normalizeEmails = (emails) =>
      (emails || [])
        .map((e) => {
          const trimmed = e.trim();
          if (!trimmed) return null;
          return trimmed.includes("@")
            ? trimmed
            : `${trimmed}@student.tdtu.edu.vn`;
        })
        .filter(Boolean);

    // Update allowed fields
    const allowedUpdates = [
      "sessionName",
      "startTime",
      "endTime",
      "accessKey",
      "classroomIds",
    ];
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        session[field] = req.body[field];
      }
    });

    // Handle blacklist with normalization
    if (req.body.blacklist !== undefined) {
      session.blacklist = normalizeEmails(req.body.blacklist);
    }

    // If classroomIds or whitelist changed, recompute merged whitelist
    const classroomEmails = await resolveClassroomEmails(
      session.classroomIds || [],
    );
    const manualWhitelist = normalizeEmails(
      req.body.whitelist || session.whitelist || [],
    );
    session.whitelist = [...new Set([...manualWhitelist, ...classroomEmails])];

    await session.save();
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session (Lecturer only, if not started)
examSessionRouter.delete(
  "/:id",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
        status: "scheduled",
      });

      if (!session) {
        return res.status(404).json({
          error: "Session not found, already started, or access denied",
        });
      }

      await session.deleteOne();
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Start exam session (Lecturer only)
examSessionRouter.post(
  "/:id/start",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      });

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      session.status = "ongoing";
      await session.save();

      res.json({ session });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// End exam session (Lecturer only)
examSessionRouter.post(
  "/:id/end",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      });

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      session.status = "ended";
      await session.save();

      res.json({ session });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Helper to assign exam code using modulo + random offset to guarantee
// adjacent computer orders never share the same exam code.
// A random offset is chosen per session (seeded by the first student) so the
// starting code varies, but the pattern stays deterministic.
const assignExamCodeAndCreateRecords = async (
  session,
  studentId,
  computerOrder,
) => {
  const template = session.examTemplateId;
  if (!template || !template.examCodes || template.examCodes.length === 0)
    return null;

  const allCodes = template.examCodes;
  let assignedCode = null;

  if (computerOrder != null && allCodes.length > 1) {
    // Determine the random offset for this session.
    // We look at the first assigned code in this session to derive the offset.
    // If no one has been assigned yet, pick a new random offset.
    const firstAssigned = await StudentExamCodeModel.findOne({
      examSessionId: session._id,
      computerOrder: { $ne: null },
    }).sort({ computerOrder: 1 });

    let offset;
    if (firstAssigned) {
      // Derive offset from the first student's assignment
      const firstCodeIndex = allCodes.findIndex(
        (c) => c.codeNumber === firstAssigned.examCodeNumber,
      );
      // offset = firstCodeIndex - ((firstAssigned.computerOrder - 1) % allCodes.length)
      offset =
        ((firstCodeIndex -
          ((firstAssigned.computerOrder - 1) % allCodes.length)) %
          allCodes.length +
          allCodes.length) %
        allCodes.length;
    } else {
      offset = Math.floor(Math.random() * allCodes.length);
    }

    const codeIndex = (computerOrder - 1 + offset) % allCodes.length;
    assignedCode = allCodes[codeIndex];
  }

  // Fallback: random assignment when computerOrder is null or only 1 code exists
  if (!assignedCode) {
    const randomIndex = Math.floor(Math.random() * allCodes.length);
    assignedCode = allCodes[randomIndex];
  }

  // Atomic upsert — guarantees no duplicate StudentExamCode for the same
  // (examSession, student). Idempotent on concurrent client retries.
  const studentCode = await StudentExamCodeModel.findOneAndUpdate(
    { examSessionId: session._id, studentId },
    {
      $setOnInsert: {
        examSessionId: session._id,
        studentId,
        examCodeNumber: assignedCode.codeNumber,
        computerOrder: computerOrder || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Idempotent submission creation — uses upsert + unique compound index.
  await StudentSubmissionModel.updateOne(
    { examSessionId: session._id, studentId },
    {
      $setOnInsert: {
        examSessionId: session._id,
        studentId,
        examCodeNumber: studentCode.examCodeNumber,
        submissions: [],
      },
    },
    { upsert: true },
  );

  return studentCode;
};

// Assign random exam code to student when they join (Student only)
examSessionRouter.post(
  "/:id/assign-code",
  isAuthenticated,
  async (req, res) => {
    try {
      const user = await resolveCurrentUser(req);

      if (!user || user.role !== "student") {
        return res.status(403).json({ error: "Student only endpoint" });
      }

      const { accessKey } = req.body;
      const session = await ExamSessionModel.findById(req.params.id).populate(
        "examTemplateId",
      );

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate access key
      if (session.accessKey !== accessKey) {
        return res.status(403).json({ error: "Invalid access key" });
      }

      // Check whitelist/blacklist
      if (
        session.whitelist.length > 0 &&
        !session.whitelist.includes(user.email)
      ) {
        return res
          .status(403)
          .json({ error: "You are not whitelisted for this exam" });
      }

      if (session.blacklist.includes(user.email)) {
        return res
          .status(403)
          .json({ error: "You are blacklisted from this exam" });
      }

      // Check time
      const now = new Date();
      if (now < session.startTime) {
        return res.status(400).json({ error: "Exam has not started yet" });
      }

      if (now > session.endTime) {
        return res.status(400).json({ error: "Exam has ended" });
      }

      // Check if student already has a code assigned
      let studentCode = await StudentExamCodeModel.findOne({
        examSessionId: session._id,
        studentId: user._id,
      });

      if (!studentCode) {
        // Assign random exam code
        const template = session.examTemplateId;
        const randomIndex = Math.floor(
          Math.random() * template.examCodes.length,
        );
        const assignedCode = template.examCodes[randomIndex];

      // Atomic upsert — same idempotency contract as the join path.
      const studentCode = await StudentExamCodeModel.findOneAndUpdate(
        { examSessionId: session._id, studentId: user._id },
        {
          $setOnInsert: {
            examSessionId: session._id,
            studentId: user._id,
            examCodeNumber: assignedCode.codeNumber,
          },
        },
        { upsert: true, new: true },
      );

      await StudentSubmissionModel.updateOne(
        { examSessionId: session._id, studentId: user._id },
        {
          $setOnInsert: {
            examSessionId: session._id,
            studentId: user._id,
            examCodeNumber: studentCode.examCodeNumber,
            submissions: [],
          },
        },
        { upsert: true },
      );
      }

      // Get the assigned exam code
      const template = session.examTemplateId;
      const examCode = template.examCodes.find(
        (code) => code.codeNumber === studentCode.examCodeNumber,
      );

      res.json({
        examCode,
        language: template.language,
        templateName: template.templateName,
        duration: template.duration,
      });
    } catch (error) {
      console.error("Error assigning exam code:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get exam for student (after assigned code)
examSessionRouter.get("/:id/exam", isAuthenticated, async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);

    if (!user) {
      console.log("User not found in DB for googleId:", req.user?.googleId);
      return res.status(403).json({ error: "User not found" });
    }

    if (user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    console.log(
      `Getting exam for user ${user.email} (ID: ${user._id}) for session ${req.params.id}`,
    );

    // Get student's assigned code
    const studentCode = await StudentExamCodeModel.findOne({
      examSessionId: req.params.id,
      studentId: user._id,
    });

    if (!studentCode) {
      console.log(
        `No exam code found for user ${user._id} in session ${req.params.id}`,
      );
      return res.status(403).json({
        error: "No exam code assigned. Please request code first.",
        userId: user._id,
        sessionId: req.params.id,
      });
    }

    const checkSubmission = await StudentSubmissionModel.findOne({
      examSessionId: req.params.id,
      studentId: user._id,
    });

    if (checkSubmission && checkSubmission.isSubmitted) {
      return res.status(403).json({
        error:
          "You have already submitted this exam and cannot access it again.",
      });
    }

    const session = await ExamSessionModel.findById(req.params.id).populate(
      "examTemplateId",
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Get the specific exam code for this student
    const template = session.examTemplateId;
    const examCode = template.examCodes.find(
      (code) => code.codeNumber === studentCode.examCodeNumber,
    );

    if (!examCode) {
      console.log(
        `Exam code #${studentCode.examCodeNumber} not found in template`,
      );
      return res.status(404).json({ error: "Exam code not found in template" });
    }

    res.json({
      exam: {
        examName: template.templateName,
        examType: template.examType,
        language: template.language,
        duration: template.duration,
        pdfResources: [examCode.pdfUrl],
        // Strip testFile.content – only expose hasTestFile flag to students
        questions: examCode.questions.map((q) => ({
          questionNumber: q.questionNumber,
          title: q.title,
          defaultMainFile: q.defaultMainFile || undefined,
          starterFiles: q.starterFiles.map((sf) => ({
            name: sf.name,
            content: sf.content,
            canDownload: sf.canDownload ?? false,
          })),
          testCases: q.testCases.map((tc) => ({
            // Never expose input/expectedOutput for hidden test cases to students
            input: tc.isHidden ? null : tc.input,
            expectedOutput: tc.isHidden ? null : tc.expectedOutput,
            isHidden: tc.isHidden,
            hasTestFile: !!tc.testFile?.content,
          })),
        })),
      },
      session: {
        sessionName: session.sessionName,
        startTime: session.startTime,
        endTime: session.endTime,
        serverTime: new Date(),
      },
    });
  } catch (error) {
    console.error("Error getting exam:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get exam session status & remaining time
examSessionRouter.get("/:id/status", isAuthenticated, async (req, res) => {
  try {
    const session = await ExamSessionModel.findById(req.params.id).select(
      "sessionName status startTime endTime",
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const now = new Date();
    const remainingTime = Math.max(0, (session.endTime - now) / 1000 / 60); // minutes

    res.json({
      sessionName: session.sessionName,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      remainingTime: Math.floor(remainingTime),
      serverTime: now,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of students in session with assigned codes (Lecturer only)
examSessionRouter.get(
  "/:id/students",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      });

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      const studentCodes = await StudentExamCodeModel.find({
        examSessionId: session._id,
      }).populate("studentId", "name email studentId avatar");

      const submissions = await StudentSubmissionModel.find({
        examSessionId: session._id,
      }).populate("studentId", "name email studentId");

      // Combine data
      const students = studentCodes.map((sc) => {
        const submission = submissions.find(
          (s) => s.studentId._id.toString() === sc.studentId._id.toString(),
        );
        return {
          student: sc.studentId,
          examCodeNumber: sc.examCodeNumber,
          computerOrder: sc.computerOrder ?? null,
          assignedAt: sc.assignedAt,
          finalScore: submission?.finalScore || 0,
          submittedAt: submission?.submittedAt,
          isSubmitted: submission?.isSubmitted || false,
          joinCount: submission?.joinCount || 0,
          tabSwitchCount: submission?.tabSwitchCount || 0,
        };
      });

      res.json({ students });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Join exam waiting list by room code (Student only)
examSessionRouter.post(
  "/join-waiting/:roomCode",
  isAuthenticated,
  async (req, res) => {
    try {
      const user = await resolveCurrentUser(req);

      if (!user || user.role !== "student") {
        return res.status(403).json({ error: "Student only endpoint" });
      }

      const { roomCode } = req.params;
      const { computerOrder, accessKey } = req.body;

      // Validate access key is provided
      if (!accessKey || !accessKey.trim()) {
        return res.status(400).json({ error: "Access key is required" });
      }

      const session = await ExamSessionModel.findOne({
        roomCode: roomCode.toUpperCase(),
      }).populate("examTemplateId");

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate access key
      if (session.accessKey !== accessKey.trim()) {
        return res.status(403).json({ error: "Invalid access key" });
      }

      // Check session status
      if (session.status === "scheduled") {
        return res.status(400).json({ error: "Exam has not started yet" });
      }
      if (session.status === "ended") {
        return res.status(400).json({ error: "Exam has ended" });
      }

      // Check if user has already submitted the exam
      const submission = await StudentSubmissionModel.findOne({
        examSessionId: session._id,
        studentId: user._id,
      });

      if (submission && submission.isSubmitted) {
        return res.status(403).json({
          error: "You have already submitted this exam. Access denied.",
        });
      }

      // Check blacklist
      if (session.blacklist.includes(user.email)) {
        return res
          .status(403)
          .json({ error: "You are blacklisted from this exam" });
      }

      // Check if student already has a code (returning student)
      const existingCode = await StudentExamCodeModel.findOne({
        examSessionId: session._id,
        studentId: user._id,
      });
      const hasComputerOrder = existingCode?.computerOrder != null;

      // Determine the effective computerOrder:
      // If student already has one stored, use it; otherwise use the submitted value.
      const effectiveComputerOrder = hasComputerOrder
        ? existingCode.computerOrder
        : computerOrder;

      // Validate duplicate computerOrder (only when student is submitting a NEW one)
      if (!hasComputerOrder && effectiveComputerOrder != null) {
        // Check in StudentExamCode records
        const duplicateCode = await StudentExamCodeModel.findOne({
          examSessionId: session._id,
          computerOrder: effectiveComputerOrder,
          studentId: { $ne: user._id },
        });
        // Also check in waiting list
        const duplicateWaiting = session.waitingList.find(
          (entry) =>
            entry.computerOrder === effectiveComputerOrder &&
            entry.userId.toString() !== user._id.toString(),
        );
        if (duplicateCode || duplicateWaiting) {
          return res.status(400).json({
            error: `Computer order #${effectiveComputerOrder} is already taken by another student`,
          });
        }
      }

      // ── OPEN MODE: auto-approve ──────────────────────────────────────────
      if (session.entryMode === "open") {
        // Add to whitelist if not already
        if (!session.whitelist.includes(user.email)) {
          session.whitelist.push(user.email);
        }

        // Check if student already has a code assigned
        let studentCode = existingCode;

        if (!studentCode && session.examTemplateId?.examCodes?.length > 0) {
          studentCode = await assignExamCodeAndCreateRecords(
            session,
            user._id,
            effectiveComputerOrder,
          );
        }

        await session.save();

        notifySessionUpdate(session._id);

        return res.json({
          directEntry: true,
          sessionId: session._id,
          message: "Access granted",
          hasComputerOrder: studentCode?.computerOrder != null,
        });
      }

      // ── APPROVAL MODE: add to waiting list ────────────────────────────────
      // If student is already in whitelist (pre-approved via classroom), grant direct entry
      if (session.whitelist.includes(user.email)) {
        // Ensure exam code is assigned
        let studentCode = existingCode;

        if (!studentCode && session.examTemplateId?.examCodes?.length > 0) {
          studentCode = await assignExamCodeAndCreateRecords(
            session,
            user._id,
            effectiveComputerOrder,
          );
        }

        notifySessionUpdate(session._id);

        return res.json({
          directEntry: true,
          sessionId: session._id,
          message: "Access granted (pre-whitelisted)",
          hasComputerOrder: studentCode?.computerOrder != null,
        });
      }

      // Check if already in waiting list
      const existingEntry = session.waitingList.find(
        (entry) => entry.userId.toString() === user._id.toString(),
      );
      if (existingEntry) {
        // Don't allow changing computerOrder once set
        return res.json({
          directEntry: false,
          message: "Already in waiting list",
          sessionId: session._id,
          hasComputerOrder: existingEntry.computerOrder != null,
        });
      }

      // Add to waiting list with computerOrder
      session.waitingList.push({
        userId: user._id,
        computerOrder: effectiveComputerOrder || null,
      });
      await session.save();

      notifySessionUpdate(session._id);

      res.json({
        directEntry: false,
        message: "Added to waiting list",
        sessionId: session._id,
        hasComputerOrder: effectiveComputerOrder != null,
      });
    } catch (error) {
      console.error("Error joining waiting list:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Get waiting list for exam (Lecturer only)
examSessionRouter.get(
  "/:id/waiting",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      }).populate("waitingList.userId", "name email studentId");

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      // Format response
      const waitingStudents = session.waitingList.map((entry) => ({
        _id: entry.userId._id,
        name: entry.userId.name,
        email: entry.userId.email,
        studentId: entry.userId.studentId,
        computerOrder: entry.computerOrder,
      }));

      res.json({ waitingStudents, entryMode: session.entryMode });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Approve single waiting student (Lecturer only)
examSessionRouter.post(
  "/:id/approve-waiting/:studentId",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      }).populate("examTemplateId");

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      const student = await UserModel.findById(req.params.studentId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      // Find the waiting entry to get computerOrder
      const waitingEntry = session.waitingList.find(
        (entry) => entry.userId.toString() === req.params.studentId,
      );
      const computerOrder = waitingEntry?.computerOrder ?? null;

      // Remove from waiting list
      session.waitingList = session.waitingList.filter(
        (entry) => entry.userId.toString() !== req.params.studentId,
      );

      // Add to whitelist
      if (!session.whitelist.includes(student.email)) {
        session.whitelist.push(student.email);
      }

      await session.save();

      // Create StudentExamCode record if it doesn't exist
      try {
        let studentCode = await StudentExamCodeModel.findOne({
          examSessionId: session._id,
          studentId: student._id,
        });

        if (!studentCode && session.examTemplateId.examCodes?.length > 0) {
          studentCode = await assignExamCodeAndCreateRecords(
            session,
            student._id,
            computerOrder,
          );

          console.log(
            `Exam code assigned to student ${student.email}: code #${studentCode.examCodeNumber} (computer: ${computerOrder})`,
          );
        }
      } catch (codeError) {
        console.error(
          "Error creating exam code for approved student:",
          codeError,
        );
      }

      notifySessionUpdate(req.params.id);

      res.json({
        message: "Student approved and added to whitelist",
        studentId: student._id,
        studentEmail: student.email,
      });
    } catch (error) {
      console.error("Error in approve-waiting endpoint:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Approve all waiting students (Lecturer only)
examSessionRouter.post(
  "/:id/approve-all-waiting",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const session = await ExamSessionModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      }).populate("waitingList.userId examTemplateId");

      if (!session) {
        return res
          .status(404)
          .json({ error: "Session not found or access denied" });
      }

      // Add all waiting students to whitelist and create exam codes
      for (const entry of session.waitingList) {
        const student = entry.userId;
        const computerOrder = entry.computerOrder ?? null;

        if (!session.whitelist.includes(student.email)) {
          session.whitelist.push(student.email);
        }

        // Create StudentExamCode if doesn't exist
        let studentCode = await StudentExamCodeModel.findOne({
          examSessionId: session._id,
          studentId: student._id,
        });

        if (!studentCode && session.examTemplateId?.examCodes?.length > 0) {
          studentCode = await assignExamCodeAndCreateRecords(
            session,
            student._id,
            computerOrder,
          );
        }
      }

      // Clear waiting list
      session.waitingList = [];

      await session.save();

      notifySessionUpdate(req.params.id);

      res.json({ message: "All waiting students approved" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default examSessionRouter;
