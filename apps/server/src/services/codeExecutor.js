import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  executeCppWithNsjail,
  executeJavaWithNsjail,
  executeJavaScriptWithNsjail,
  executePythonWithNsjail,
  validateFileName,
} from "./nsjailExecutor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUBMISSIONS_DIR = path.join(__dirname, "../../temp/submissions");

const EXTENSION_BY_LANGUAGE = {
  java: "java",
  python: "py",
  javascript: "js",
  cpp: "cpp",
};

function defaultFileName(language) {
  switch (language) {
    case "java":
      return "Main.java";
    case "python":
      return "main.py";
    case "javascript":
      return "main.js";
    case "cpp":
      return "main.cpp";
    default:
      return "main.txt";
  }
}

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

/**
 * Builds the file list that should be written for execution, after validating
 * every filename. Throws if any name is unsafe (path traversal, absolute, etc.).
 */
function buildExecutionFileList(submission) {
  const mainFile = submission.mainFile || defaultFileName(submission.language);
  const ext = EXTENSION_BY_LANGUAGE[submission.language];
  if (ext && !mainFile.endsWith(`.${ext}`)) {
    throw new Error(
      `Main file "${mainFile}" must use the .${ext} extension for ${submission.language}`,
    );
  }

  const fileList =
    submission.files?.length > 0
      ? submission.files.map((f) => ({ name: f.name, content: f.content }))
      : [{ name: mainFile, content: submission.code || "" }];

  for (const file of fileList) {
    if (!validateFileName(file.name)) {
      throw new Error(`Invalid file name rejected: "${file.name}"`);
    }
  }
  return { fileList, mainFile };
}

/**
 * Execute a submission. Every language is dispatched through the nsjail
 * executor so untrusted student code never runs as a host subprocess.
 */
export async function executeCodeLocally(submission, testcases) {
  if (!submission?.language) {
    throw new Error("Submission language is required");
  }

  const { fileList, mainFile } = buildExecutionFileList(submission);

  switch (submission.language) {
    case "java":
      return executeJavaWithNsjail({ ...submission, files: fileList, mainFile }, testcases);
    case "python":
      return executePythonWithNsjail({ ...submission, files: fileList, mainFile }, testcases);
    case "javascript":
      return executeJavaScriptWithNsjail(
        { ...submission, files: fileList, mainFile },
        testcases,
      );
    case "cpp":
      return executeCppWithNsjail({ ...submission, files: fileList, mainFile }, testcases);
    default:
      return {
        results: [
          {
            testcaseId: "compile",
            passed: false,
            executionTime: 0,
            output: "",
            error: `Unsupported language: ${submission.language}`,
          },
        ],
        status: "compile_error",
        passedCount: 0,
      };
  }
}

// Re-exported for backward-compat with tests that exercise validation helpers.
export { buildExecutionFileList, normalizeFiles, normalizeCode, defaultFileName };
// Ensure fs is treated as used (kept for future porting); reference it quietly.
void fs;
void SUBMISSIONS_DIR;
