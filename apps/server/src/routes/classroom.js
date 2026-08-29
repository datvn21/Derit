import { Router } from "express";
import ClassroomModel from "../models/Classroom.js";
import UserModel from "../models/User.js";
import { isAuthenticated } from "../middleware/middlewareAuth.js";
import { isLecturerOrAdmin } from "../middleware/isLecturerOrAdmin.js";

const classroomRouter = Router();

function normalizeAcademicYear(value) {
  const year =
    value === undefined || value === null || String(value).trim() === ""
      ? String(new Date().getFullYear())
      : String(value).trim();

  if (!/^\d{4}$/.test(year)) return null;

  const numericYear = Number(year);
  if (numericYear < 2000 || numericYear > new Date().getFullYear() + 1) {
    return null;
  }

  return year;
}

// POST /classrooms/lookup-students - Lookup student profiles by IDs or Emails
classroomRouter.post(
  "/lookup-students",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const { studentIds } = req.body;
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.json({ students: [] });
      }

      const cleanQueries = studentIds
        .map((s) => String(s).trim())
        .filter(Boolean);

      if (cleanQueries.length === 0) {
        return res.json({ students: [] });
      }

      const candidates = new Set();
      const emailCandidates = new Set();

      for (const q of cleanQueries) {
        const raw = q.toLowerCase();
        const prefix = raw.includes("@") ? raw.split("@")[0] : raw;
        candidates.add(prefix);
        candidates.add(raw);
        emailCandidates.add(raw);
        emailCandidates.add(`${prefix}@student.tdtu.edu.vn`);
      }

      const candidateList = Array.from(candidates);
      const emailList = Array.from(emailCandidates);

      const users = await UserModel.find({
        $or: [
          { studentId: { $in: candidateList } },
          { email: { $in: emailList } },
          {
            studentId: {
              $in: candidateList.map((c) => new RegExp(`^${c}$`, "i")),
            },
          },
          {
            email: {
              $in: emailList.map((e) => new RegExp(`^${e}$`, "i")),
            },
          },
        ],
      }).select("name email avatar studentId");

      const results = users.map((u) => ({
        studentId: u.studentId || (u.email ? u.email.split("@")[0] : ""),
        name: u.name,
        email: u.email,
        avatar: u.avatar || "",
      }));

      res.json({ students: results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// POST /classrooms - Create a classroom
classroomRouter.post(
  "/",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const { classroomName, academicYear, students } = req.body;

      if (!classroomName || !classroomName.trim()) {
        return res.status(400).json({ error: "Classroom name is required" });
      }

      const normalizedAcademicYear = normalizeAcademicYear(academicYear);
      if (!normalizedAcademicYear) {
        return res
          .status(400)
          .json({ error: "Academic year must be a valid year" });
      }

      const classroom = await ClassroomModel.create({
        classroomName: classroomName.trim(),
        academicYear: normalizedAcademicYear,
        students: Array.isArray(students)
          ? students.map((s) => s.trim()).filter(Boolean)
          : [],
        createdBy: req.dbUser._id,
      });

      res.status(201).json({ classroom });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /classrooms - List all classrooms for the current lecturer
classroomRouter.get(
  "/",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const classrooms = await ClassroomModel.find({
        createdBy: req.dbUser._id,
      }).sort({ createdAt: -1 });

      res.json({ classrooms });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// GET /classrooms/:id - Get a single classroom
classroomRouter.get(
  "/:id",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const classroom = await ClassroomModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      });

      if (!classroom) {
        return res
          .status(404)
          .json({ error: "Classroom not found or access denied" });
      }

      res.json({ classroom });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// PUT /classrooms/:id - Update a classroom
classroomRouter.put(
  "/:id",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const classroom = await ClassroomModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      });

      if (!classroom) {
        return res
          .status(404)
          .json({ error: "Classroom not found or access denied" });
      }

      const { classroomName, academicYear, students } = req.body;

      if (classroomName !== undefined) {
        classroom.classroomName = classroomName.trim();
      }
      if (academicYear !== undefined) {
        const normalizedAcademicYear = normalizeAcademicYear(academicYear);
        if (!normalizedAcademicYear) {
          return res
            .status(400)
            .json({ error: "Academic year must be a valid year" });
        }
        classroom.academicYear = normalizedAcademicYear;
      }
      if (students !== undefined) {
        classroom.students = Array.isArray(students)
          ? students.map((s) => s.trim()).filter(Boolean)
          : [];
      }

      await classroom.save();
      res.json({ classroom });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// DELETE /classrooms/:id - Delete a classroom
classroomRouter.delete(
  "/:id",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const classroom = await ClassroomModel.findOneAndDelete({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      });

      if (!classroom) {
        return res
          .status(404)
          .json({ error: "Classroom not found or access denied" });
      }

      res.json({ message: "Classroom deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

export default classroomRouter;
