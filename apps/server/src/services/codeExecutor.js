import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { executeJavaWithNsjail, executePythonWithNsjail } from "./nsjailExecutor.js";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory cho submissions
const SUBMISSIONS_DIR = path.join(__dirname, "../../temp/submissions");

/**
 * Execute code locally với compiler/interpreter
 * @param {Object} submission - Submission object with code, language, files
 * @param {Array} testcases - Array of testcases
 * @returns {Object} Execution results
 */
export async function executeCodeLocally(submission, testcases) {
  // Java and Python run inside nsjail sandbox
  if (submission.language === "java") {
    return await executeJavaWithNsjail(submission, testcases);
  }

  if (submission.language === "python") {
    return await executePythonWithNsjail(submission, testcases);
  }

  // Other languages (C++, JS) run locally without sandbox (legacy behavior)
  const submissionId = (submission._id || Date.now()).toString();
  const submissionDir = path.join(SUBMISSIONS_DIR, submissionId);

  try {
    // 1. Create submission directory
    await fs.mkdir(submissionDir, { recursive: true });

    // 2. Write code files to directory
    if (submission.files && submission.files.length > 0) {
      // Multi-file submission
      const resolvedBase = path.resolve(submissionDir);
      for (const file of submission.files) {
        const resolvedPath = path.resolve(submissionDir, file.name);
        if (
          !resolvedPath.startsWith(resolvedBase + path.sep) &&
          resolvedPath !== resolvedBase
        ) {
          throw new Error(`Invalid file path: ${file.name}`);
        }
        await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.writeFile(resolvedPath, file.content, "utf-8");
      }
    } else {
      // Single file submission
      const fileName = getDefaultFileName(submission.language);
      await fs.writeFile(
        path.join(submissionDir, fileName),
        submission.code,
        "utf-8",
      );
    }

    // 3. Compile if needed (Java, C++)
    if (submission.language === "java" || submission.language === "cpp") {
      await compileCode(
        submissionDir,
        submission.language,
        submission.mainFile,
      );
    }

    // 4. Run testcases
    const results = [];
    let passedCount = 0;

    for (const testcase of testcases) {
      const result = await runTestcase(
        submissionDir,
        submission.language,
        submission.mainFile || getDefaultFileName(submission.language),
        testcase.input,
      );

      const passed =
        result.stdout.replace(/\r/g, "").trim() ===
        (testcase.expectedOutput ?? "").replace(/\r/g, "").trim();
      if (passed) passedCount++;

      results.push({
        testcaseId: testcase._id.toString(),
        passed,
        executionTime: result.executionTime,
        memoryUsed: 0, // TODO: Measure memory usage
        output: result.stdout,
        error: result.stderr,
      });
    }

    // 5. Determine overall status
    let status;
    if (results.some((r) => r.error && r.error.includes("timeout"))) {
      status = "time_limit_exceeded";
    } else if (results.some((r) => r.error && !r.error.includes("timeout"))) {
      status = "runtime_error";
    } else if (passedCount === testcases.length) {
      status = "accepted";
    } else {
      status = "wrong_answer";
    }

    return {
      results,
      status,
      passedCount,
    };
  } catch (error) {
    console.error("Execution error:", error);

    // Check if compilation error
    if (error.message.includes("javac") || error.message.includes("g++")) {
      return {
        results: [
          {
            testcaseId: "compile",
            passed: false,
            output: "",
            error: error.message,
          },
        ],
        status: "compile_error",
        passedCount: 0,
      };
    }

    throw error;
  } finally {
    // 6. Cleanup - delete submission directory after execution
    try {
      await fs.rm(submissionDir, { recursive: true, force: true });
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  }
}

/**
 * Compile code (for Java, C++)
 */
async function compileCode(dir, language, mainFile) {
  const startTime = Date.now();

  try {
    if (language === "java") {
      // Compile all .java files
      const { stdout, stderr } = await execAsync(`javac *.java`, {
        cwd: dir,
        timeout: 10000, // 10 seconds compile timeout
      });

      if (stderr && stderr.includes("error")) {
        throw new Error(`Compilation failed:\n${stderr}`);
      }
    } else if (language === "cpp") {
      // Compile C++ to executable
      const sourceFile = sanitizeMainFile(mainFile, "main.cpp");
      const { stdout, stderr } = await execAsync(
        `g++ ${sourceFile} -o program -std=c++17`,
        {
          cwd: dir,
          timeout: 10000,
        },
      );

      if (stderr && stderr.includes("error")) {
        throw new Error(`Compilation failed:\n${stderr}`);
      }
    }

    const compileTime = Date.now() - startTime;
    console.log(`Compiled ${language} in ${compileTime}ms`);
  } catch (error) {
    if (error.killed) {
      throw new Error("Compilation timeout");
    }
    throw error;
  }
}

/**
 * Run a single testcase
 */
async function runTestcase(dir, language, mainFile, input) {
  const startTime = Date.now();

  try {
    let command;

    switch (language) {
      case "python":
        const pyFile = sanitizeMainFile(mainFile, "main.py");
        command = `python ${pyFile}`;
        break;

      case "java":
        const className = sanitizeMainFile(mainFile, "Main.java").replace(
          ".java",
          "",
        );
        command = `java ${className}`;
        break;

      case "cpp":
        command = process.platform === "win32" ? "program.exe" : "./program";
        break;

      case "javascript":
        const jsFile = sanitizeMainFile(mainFile, "main.js");
        command = `node ${jsFile}`;
        break;

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: dir,
      timeout: 5000, // 5 seconds execution timeout
      input: input,
      maxBuffer: 1024 * 1024, // 1MB output buffer
    });

    const executionTime = Date.now() - startTime;

    return {
      stdout: stdout || "",
      stderr: stderr || "",
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    if (error.killed || error.signal === "SIGTERM") {
      return {
        stdout: "",
        stderr: "Time limit exceeded (timeout after 5s)",
        executionTime,
      };
    }

    return {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
      executionTime,
    };
  }
}

/**
 * Get default filename for language
 */
function getDefaultFileName(language) {
  const fileNames = {
    python: "main.py",
    java: "Main.java",
    cpp: "main.cpp",
    javascript: "main.js",
  };
  return fileNames[language] || "main.txt";
}

/**
 * Sanitize mainFile param — only allow safe filenames, no shell special chars
 */
function sanitizeMainFile(name, defaultName) {
  if (!name) return defaultName;
  const base = path.basename(String(name));
  // Only allow: letters, digits, dots, underscores, hyphens
  if (!/^[\w.\-]+$/.test(base)) return defaultName;
  return base;
}

/**
 * Validate and sanitize file paths
 */
function sanitizeFilePath(filePath) {
  // Remove any path traversal attempts
  const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
  return normalized;
}
