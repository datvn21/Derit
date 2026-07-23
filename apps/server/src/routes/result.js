import { Router } from "express";
import ResultModel from "../models/Result.js";
import ExamSessionModel from "../models/ExamSession.js";
import UserModel from "../models/User.js";
import { isAuthenticated } from "../middleware/middlewareAuth.js";
import { isLecturerOrAdmin } from "../middleware/isLecturerOrAdmin.js";

const resultRouter = Router();

// Get my result for exam session (Student only)
resultRouter.get("/exam/:sessionId", isAuthenticated, async (req, res) => {
  try {
    const user = await UserModel.findOne({ googleId: req.user.id });

    if (user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    const result = await ResultModel.findOne({
      examSessionId: req.params.sessionId,
      studentId: user._id,
    })
      .populate("questionScores.questionId", "title")
      .populate("questionScores.bestSubmissionId");

    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all my exam results (Student only)
resultRouter.get("/history", isAuthenticated, async (req, res) => {
  try {
    const user = await UserModel.findOne({ googleId: req.user.id });

    if (user.role !== "student") {
      return res.status(403).json({ error: "Student only endpoint" });
    }

    const results = await ResultModel.find({ studentId: user._id })
      .populate({
        path: "examSessionId",
        populate: {
          path: "examTemplateId",
          select: "examName",
        },
      })
      .sort({ createdAt: -1 });

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all results for session (Lecturer only)
resultRouter.get("/session/:sessionId", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
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

    const results = await ResultModel.find({
      examSessionId: req.params.sessionId,
    })
      .populate("studentId", "name email studentId avatar")
      .populate("questionScores.questionId", "title")
      .sort({ totalScore: -1, lastSubmittedAt: 1 });

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard/ranking (Lecturer only)
resultRouter.get(
  "/session/:sessionId/leaderboard",
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

      const results = await ResultModel.find({
        examSessionId: req.params.sessionId,
      })
        .populate("studentId", "name email studentId avatar")
        .sort({ totalScore: -1, lastSubmittedAt: 1 })
        .select(
          "studentId totalScore maxPossibleScore percentage lastSubmittedAt",
        );

      // Assign ranks
      const leaderboard = results.map((result, index) => ({
        rank: index + 1,
        student: result.studentId,
        totalScore: result.totalScore,
        maxPossibleScore: result.maxPossibleScore,
        percentage: result.percentage,
        lastSubmittedAt: result.lastSubmittedAt,
      }));

      res.json({ leaderboard });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Finalize all results (Lecturer only)
resultRouter.post(
  "/session/:sessionId/finalize",
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

      // Get all results sorted by score
      const results = await ResultModel.find({
        examSessionId: req.params.sessionId,
      }).sort({ totalScore: -1, lastSubmittedAt: 1 });

      // Assign ranks and finalize
      for (let i = 0; i < results.length; i++) {
        results[i].rank = i + 1;
        results[i].isFinalized = true;
        await results[i].save();
      }

      // Update session status to graded
      session.status = "graded";
      await session.save();

      res.json({
        message: "Results finalized successfully",
        count: results.length,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Export results to CSV (Lecturer only)
resultRouter.get(
  "/session/:sessionId/export",
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

      const results = await ResultModel.find({
        examSessionId: req.params.sessionId,
      })
        .populate("studentId", "name email studentId")
        .populate("questionScores.questionId", "title")
        .sort({ totalScore: -1, lastSubmittedAt: 1 });

      // Build CSV
      let csv =
        "Rank,Student ID,Name,Email,Total Score,Max Score,Percentage,Submitted At\n";

      results.forEach((result, index) => {
        csv += `${index + 1},`;
        csv += `${result.studentId.studentId || "N/A"},`;
        csv += `"${result.studentId.name}",`;
        csv += `${result.studentId.email},`;
        csv += `${result.totalScore},`;
        csv += `${result.maxPossibleScore},`;
        csv += `${result.percentage.toFixed(2)}%,`;
        csv += `${result.lastSubmittedAt ? result.lastSubmittedAt.toISOString() : "N/A"}\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="results_${session.sessionName}_${Date.now()}.csv"`,
      );
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default resultRouter;
