import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsBaseDir = path.join(__dirname, "../../uploads");

/**
 * Check if all required Cloudflare R2 environment variables are present.
 */
export function isR2Configured() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } =
    process.env;
  return Boolean(
    R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME,
  );
}

/**
 * Get S3Client instance for Cloudflare R2.
 */
let s3ClientInstance = null;
export function getR2Client() {
  if (!isR2Configured()) return null;
  if (!s3ClientInstance) {
    const accountId = process.env.R2_ACCOUNT_ID.trim();
    const endpoint =
      process.env.R2_ENDPOINT?.trim() ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Format public URL for an R2 object key.
 */
export function getR2PublicUrl(key) {
  const publicBase = process.env.R2_PUBLIC_URL?.trim();
  if (!publicBase) {
    // If no public domain configured, fallback to R2 endpoint format
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const bucket = process.env.R2_BUCKET_NAME?.trim();
    return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
  }
  const cleanBase = publicBase.replace(/\/+$/, "");
  const cleanKey = key.replace(/^\/+/, "");
  return `${cleanBase}/${cleanKey}`;
}

/**
 * Resolve local filesystem path from a relative or /uploads/... pdfUrl.
 */
export function resolveLocalPdfPath(pdfUrl) {
  if (!pdfUrl || typeof pdfUrl !== "string") return null;
  
  // If it's already an absolute or full path within uploads
  const filename = path.basename(pdfUrl);
  const candidatePdfsPath = path.join(uploadsBaseDir, "pdfs", filename);
  const candidateUploadsPath = path.join(uploadsBaseDir, filename);

  return { candidatePdfsPath, candidateUploadsPath, filename };
}

/**
 * Upload all exam code PDF files for an exam session to Cloudflare R2.
 * Stores files under `sessions/<sessionId>/<codeNumber>_<filename>`.
 *
 * @param {Object} session - The ExamSession document
 * @param {Object} template - The populated ExamTemplate document
 * @returns {Promise<Array<{ codeNumber: string, localPdfUrl: string, r2Key: string, r2Url: string }>>}
 */
export async function uploadSessionPdfs(session, template) {
  if (!isR2Configured()) {
    console.log("[R2] Cloudflare R2 is not configured. Skipping upload.");
    return [];
  }

  const s3 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME.trim();
  const sessionId = session._id.toString();
  const uploadedResources = [];

  if (!template?.examCodes || template.examCodes.length === 0) {
    return uploadedResources;
  }

  for (const examCode of template.examCodes) {
    if (!examCode.pdfUrl) continue;

    try {
      const { candidatePdfsPath, candidateUploadsPath, filename } =
        resolveLocalPdfPath(examCode.pdfUrl);

      // Check if file exists locally
      let filePath = null;
      try {
        await fs.access(candidatePdfsPath);
        filePath = candidatePdfsPath;
      } catch {
        try {
          await fs.access(candidateUploadsPath);
          filePath = candidateUploadsPath;
        } catch {
          console.warn(
            `[R2] Local PDF file not found for exam code ${examCode.codeNumber}: ${examCode.pdfUrl}`,
          );
          continue;
        }
      }

      const fileBuffer = await fs.readFile(filePath);
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const r2Key = `sessions/${sessionId}/${examCode.codeNumber}_${sanitizedFilename}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: r2Key,
        Body: fileBuffer,
        ContentType: "application/pdf",
      });

      await s3.send(command);

      const r2Url = getR2PublicUrl(r2Key);
      uploadedResources.push({
        codeNumber: examCode.codeNumber,
        localPdfUrl: examCode.pdfUrl,
        r2Key,
        r2Url,
      });

      console.log(
        `[R2] Successfully uploaded PDF for session ${sessionId} code #${examCode.codeNumber} -> ${r2Key}`,
      );
    } catch (err) {
      console.error(
        `[R2] Error uploading PDF for exam code ${examCode.codeNumber}:`,
        err.message,
      );
    }
  }

  return uploadedResources;
}

/**
 * Delete all PDF files on Cloudflare R2 associated with an exam session.
 *
 * @param {string|Object} sessionId - Session ID
 * @param {Array<string>} [specificKeys] - Optional array of R2 keys to delete
 */
export async function deleteSessionPdfs(sessionId, specificKeys = []) {
  if (!isR2Configured()) {
    return;
  }

  const s3 = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME.trim();
  const sid = sessionId.toString();
  const prefix = `sessions/${sid}/`;

  try {
    const keysToDelete = new Set(specificKeys.filter(Boolean));

    // List all objects in bucket with prefix sessions/<sessionId>/
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      });
      const listResponse = await s3.send(listCommand);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        listResponse.Contents.forEach((obj) => {
          if (obj.Key) keysToDelete.add(obj.Key);
        });
      }
    } catch (listErr) {
      console.warn(`[R2] Error listing objects under prefix ${prefix}:`, listErr.message);
    }

    if (keysToDelete.size === 0) {
      console.log(`[R2] No objects to delete for session ${sid}`);
      return;
    }

    const objects = Array.from(keysToDelete).map((key) => ({ Key: key }));

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: objects,
        Quiet: true,
      },
    });

    await s3.send(deleteCommand);
    console.log(
      `[R2] Successfully deleted ${objects.length} file(s) for session ${sid} from R2`,
    );
  } catch (err) {
    console.error(`[R2] Error deleting session PDFs for ${sid}:`, err.message);
  }
}
