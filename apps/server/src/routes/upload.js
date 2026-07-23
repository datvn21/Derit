import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { isAuthenticated } from "../middleware/middlewareAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadRouter = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../../uploads/pdfs");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// PDF Magic Numbers for validation (more reliable than mimetype)
const PDF_SIGNATURES = [
  Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
];

// Validate if file is actually a PDF by checking magic numbers
const isPDFFile = (filePath) => {
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    return PDF_SIGNATURES.some((sig) => buffer.equals(sig));
  } catch (error) {
    console.error("Error validating PDF:", error);
    return false;
  }
};

// Sanitize filename to prevent path traversal
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
};

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const sanitized = sanitizeFilename(file.originalname);
    const uniqueName = `${Date.now()}_${sanitized}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Check mimetype first (client-side check)
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// Upload PDF endpoint
uploadRouter.post(
  "/pdf",
  isAuthenticated,
  upload.single("pdf"),
  async (req, res) => {
    let uploadedFilePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      uploadedFilePath = req.file.path;

      // Validate actual file content (magic number check)
      if (!isPDFFile(uploadedFilePath)) {
        // Clean up invalid file
        fs.unlinkSync(uploadedFilePath);
        return res.status(400).json({ error: "Invalid PDF file format" });
      }

      // Return URL that can be accessed via static file serving
      const fileUrl = `/uploads/pdfs/${req.file.filename}`;

      res.json({
        success: true,
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
      });
    } catch (error) {
      // Clean up file on error
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  },
);

// Delete PDF endpoint with security checks
uploadRouter.delete("/pdf/:filename", isAuthenticated, (req, res) => {
  try {
    const { filename } = req.params;

    // Prevent path traversal
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const filePath = path.join(uploadsDir, filename);

    // Ensure file is within uploads directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: "File deleted" });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message || "Delete failed" });
  }
});

// Multer error handling middleware
uploadRouter.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds 10MB limit" });
    }
    return res.status(400).json({ error: error.message });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  next();
});

export default uploadRouter;
