import { Router } from "express";
import ClassroomModel from "../models/Classroom.js";
import { isAuthenticated } from "../middleware/middlewareAuth.js";
import { isLecturerOrAdmin } from "../middleware/isLecturerOrAdmin.js";

const classroomRouter = Router();

// POST /classrooms — Create a classroom
classroomRouter.post("/", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
    try {
        const { classroomName, students } = req.body;

        if (!classroomName || !classroomName.trim()) {
            return res.status(400).json({ error: "Classroom name is required" });
        }

        const classroom = await ClassroomModel.create({
            classroomName: classroomName.trim(),
            students: Array.isArray(students) ? students.map((s) => s.trim()).filter(Boolean) : [],
            createdBy: req.dbUser._id,
        });

        res.status(201).json({ classroom });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /classrooms — List all classrooms for the current lecturer
classroomRouter.get("/", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
    try {
        const classrooms = await ClassroomModel.find({
            createdBy: req.dbUser._id,
        }).sort({ createdAt: -1 });

        res.json({ classrooms });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /classrooms/:id — Get a single classroom
classroomRouter.get("/:id", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
    try {
        const classroom = await ClassroomModel.findOne({
            _id: req.params.id,
            createdBy: req.dbUser._id,
        });

        if (!classroom) {
            return res.status(404).json({ error: "Classroom not found or access denied" });
        }

        res.json({ classroom });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /classrooms/:id — Update a classroom
classroomRouter.put("/:id", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
    try {
        const classroom = await ClassroomModel.findOne({
            _id: req.params.id,
            createdBy: req.dbUser._id,
        });

        if (!classroom) {
            return res.status(404).json({ error: "Classroom not found or access denied" });
        }

        const { classroomName, students } = req.body;

        if (classroomName !== undefined) {
            classroom.classroomName = classroomName.trim();
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
});

// DELETE /classrooms/:id — Delete a classroom
classroomRouter.delete("/:id", isAuthenticated, isLecturerOrAdmin, async (req, res) => {
    try {
        const classroom = await ClassroomModel.findOneAndDelete({
            _id: req.params.id,
            createdBy: req.dbUser._id,
        });

        if (!classroom) {
            return res.status(404).json({ error: "Classroom not found or access denied" });
        }

        res.json({ message: "Classroom deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default classroomRouter;
