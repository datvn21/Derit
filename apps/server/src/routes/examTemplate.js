import { Router } from "express";
import ExamTemplateModel from "../models/ExamTemplate.js";
import UserModel from "../models/User.js";
import { isAuthenticated } from "../middleware/middlewareAuth.js";
import { isLecturerOrAdmin } from "../middleware/isLecturerOrAdmin.js";

const examTemplateRouter = Router();

/**
 * @swagger
 * /exam-templates:
 *   post:
 *     summary: Create new exam template (Lecturer only)
 *     tags: [Exam Templates]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateName
 *               - examType
 *               - language
 *               - duration
 *               - examCodes
 *             properties:
 *               templateName:
 *                 type: string
 *               examType:
 *                 type: string
 *                 enum: [OOP, DSA, General]
 *               language:
 *                 type: string
 *                 enum: [java, python]
 *               duration:
 *                 type: number
 *               examCodes:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 template:
 *                   $ref: '#/components/schemas/ExamTemplate'
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Access denied
 */
// Create exam template with exam codes (Lecturer only)
examTemplateRouter.post(
  "/",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const {
        templateName,
        examType, // 'OOP', 'DSA', 'General'
        language, // 'java' or 'python'
        duration,
        isPublished,
        examCodes, // Array of exam codes with PDF and questions
      } = req.body;

      // Validate required fields
      if (!templateName || !examType || !language || !duration) {
        return res.status(400).json({
          error:
            "Missing required fields: templateName, examType, language, duration",
        });
      }

      if (!examCodes || examCodes.length === 0) {
        return res.status(400).json({
          error: "At least one exam code is required",
        });
      }

      // Auto-set language based on exam type if not provided correctly
      let finalLanguage = language;
      if (examType === "OOP" || examType === "DSA") {
        finalLanguage = "java"; // Force Java for OOP/DSA
      }

      // Schema pre-save hook will calculate totalPoints automatically
      const newTemplate = await ExamTemplateModel.create({
        templateName,
        examType,
        language: finalLanguage,
        duration,
        isPublished: Boolean(isPublished),
        examCodes,
        createdBy: req.dbUser._id,
      });

      res.status(201).json({ template: newTemplate });
    } catch (error) {
      console.error("Error creating exam template:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * @swagger
 * /exam-templates:
 *   get:
 *     summary: Get all exam templates created by current lecturer
 *     tags: [Exam Templates]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of exam templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 templates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ExamTemplate'
 *       403:
 *         description: Access denied
 */
// Get all templates (created by current lecturer)
examTemplateRouter.get(
  "/",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const templates = await ExamTemplateModel.find({
        createdBy: req.dbUser._id,
      }).sort({ createdAt: -1 });

      // Add exam code count to each template
      const templatesWithCount = templates.map((template) => ({
        ...template.toObject(),
        examCodeCount: template.examCodes.length,
      }));

      res.json({ templates: templatesWithCount });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * @swagger
 * /exam-templates/{id}:
 *   get:
 *     summary: Get exam template details
 *     tags: [Exam Templates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 template:
 *                   $ref: '#/components/schemas/ExamTemplate'
 *       404:
 *         description: Template not found
 */
function getTemplateQuery(req) {
  if (req.dbUser?.role === "admin") {
    return { _id: req.params.id };
  }
  return { _id: req.params.id, createdBy: req.dbUser._id };
}

// Get template details
examTemplateRouter.get(
  "/:id",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const template = await ExamTemplateModel.findOne(getTemplateQuery(req));

      if (!template) {
        return res
          .status(404)
          .json({ error: "Template not found or access denied" });
      }

      res.json({ template });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Update template
examTemplateRouter.put(
  "/:id",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const template = await ExamTemplateModel.findOne(getTemplateQuery(req));

      if (!template) {
        return res
          .status(404)
          .json({ error: "Template not found or access denied" });
      }

      // Update allowed fields
      const allowedUpdates = [
        "templateName",
        "examType",
        "language",
        "duration",
        "isPublished",
        "examCodes",
      ];
      allowedUpdates.forEach((field) => {
        if (req.body[field] !== undefined) {
          template[field] = req.body[field];
        }
      });

      await template.save();
      res.json({ template });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Delete template
examTemplateRouter.delete(
  "/:id",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const template = await ExamTemplateModel.findOneAndDelete(
        getTemplateQuery(req),
      );

      if (!template) {
        return res
          .status(404)
          .json({ error: "Template not found or access denied" });
      }

      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Publish/Unpublish template
const togglePublishHandler = async (req, res) => {
  try {
    const template = await ExamTemplateModel.findOne(getTemplateQuery(req));

    if (!template) {
      return res
        .status(404)
        .json({ error: "Template not found or access denied" });
    }

    const nextStatus =
      typeof req.body?.isPublished === "boolean"
        ? req.body.isPublished
        : !template.isPublished;

    const updated = await ExamTemplateModel.findByIdAndUpdate(
      template._id,
      { $set: { isPublished: nextStatus } },
      { new: true },
    );

    res.json({ template: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

examTemplateRouter.patch(
  "/:id/publish",
  isAuthenticated,
  isLecturerOrAdmin,
  togglePublishHandler,
);
examTemplateRouter.put(
  "/:id/publish",
  isAuthenticated,
  isLecturerOrAdmin,
  togglePublishHandler,
);

// Share template to another lecturer by email
examTemplateRouter.post(
  "/:id/share",
  isAuthenticated,
  isLecturerOrAdmin,
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Find the template owned by current user
      const template = await ExamTemplateModel.findOne({
        _id: req.params.id,
        createdBy: req.dbUser._id,
      });

      if (!template) {
        return res
          .status(404)
          .json({ error: "Template not found or access denied" });
      }

      // Find the recipient user by email
      const recipient = await UserModel.findOne({ email });

      if (!recipient) {
        return res.status(404).json({ error: "No user found with that email" });
      }

      if (recipient._id.toString() === req.dbUser._id.toString()) {
        return res
          .status(400)
          .json({ error: "You cannot share a template with yourself" });
      }

      // Generate random 6-character alphanumeric string
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let randomSuffix = "";
      for (let i = 0; i < 6; i++) {
        randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Duplicate the template with modified name and new owner
      const templateData = template.toObject();
      delete templateData._id;
      delete templateData.createdAt;
      delete templateData.updatedAt;
      delete templateData.__v;

      const newTemplate = await ExamTemplateModel.create({
        ...templateData,
        templateName: `${template.templateName}_${randomSuffix}`,
        createdBy: recipient._id,
        isPublished: false, // Reset publish status for the copy
      });

      res.status(201).json({
        message: `Template shared successfully to ${recipient.email}`,
        template: newTemplate,
      });
    } catch (error) {
      console.error("Error sharing exam template:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default examTemplateRouter;
