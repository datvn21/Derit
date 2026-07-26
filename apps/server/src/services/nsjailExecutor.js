import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Sema } from "async-sema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ─────────────────────────────────────────────────────────────
// Note: These defaults work for both Alpine (Docker) and Ubuntu/Debian (VPS)
// Alpine: /usr/lib/jvm/java-11-openjdk, /usr/bin/python3
// Ubuntu: /usr/lib/jvm/java-11-openjdk-amd64, /usr/bin/python3
const NSJAIL_PATH = process.env.NSJAIL_PATH || "/usr/bin/nsjail";
const NSJAIL_CONFIG_DIR = process.env.NSJAIL_CONFIG_DIR || path.join(__dirname, "../../config");
const WORKSPACE_DIR = process.env.NSJAIL_WORKSPACE_DIR || path.join(__dirname, "../../temp/nsjail-workspace");
const JAVA_HOME = process.env.JAVA_HOME || "/usr/lib/jvm/java-11-openjdk";
const PYTHON_BIN = process.env.PYTHON_BIN || "/usr/bin/python3";
const NSJAIL_DISABLE_NEWNS = process.env.NSJAIL_DISABLE_NEWNS === "true";
const JAVAC_BIN = path.join(JAVA_HOME, "bin/javac");
const JAVA_BIN = path.join(JAVA_HOME, "bin/java");

const COMPILE_TIMEOUT = parseInt(process.env.COMPILE_TIMEOUT) || 10000; // 10s
const RUN_TIMEOUT = parseInt(process.env.RUN_TIMEOUT) || 5000; // 5s per testcase
const MEMORY_LIMIT_MB = parseInt(process.env.NSJAIL_MEMORY_LIMIT_MB) || 512;
const MAX_CONCURRENT = parseInt(process.env.NSJAIL_MAX_CONCURRENT) || 4;
const QUEUE_TIMEOUT_MS = parseInt(process.env.NSJAIL_QUEUE_TIMEOUT) || 30000;

// ─── Semaphore for concurrent execution limit ──────────────────────────────────
const semaphore = new Sema(MAX_CONCURRENT);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate a submitted file name to prevent path traversal attacks.
 */
function validateFileName(name) {
  if (!name || typeof name !== "string") return false;
  if (name.includes("..")) return false;
  if (name.includes("\\")) return false;
  if (path.isAbsolute(name)) return false;
  return true;
}

/**
 * Run nsjail with a config file and return stdout/stderr.
 * @param {string} workspacePath - The workspace directory to mount inside the jail
 * @param {string} configFile - Path to nsjail config file
 * @param {Array} cmd - Command and arguments to run
 * @param {number} timeoutMs - Timeout in milliseconds
 * Returns { stdout, stderr, exitCode, timedOut }
 */
function execNsjail(workspacePath, configFile, cmd, timeoutMs) {
  return new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    let settled = false;

    const done = (exitCode, timedOut) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: exitCode ?? -1,
        timedOut: !!timedOut,
      });
    };

    const nsjailArgs = NSJAIL_DISABLE_NEWNS
      ? ["-Mo", "--disable_clone_newns", "--disable_clone_newnet", "-D", workspacePath, "--", ...cmd]
      : ["-C", configFile, "-B", `${workspacePath}:/workspace`, "--", ...cmd];

    const child = spawn(NSJAIL_PATH, nsjailArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

    child.on("error", (err) => {
      if (!settled) {
        stderrChunks.push(Buffer.from(`\n[spawn error] ${err.message}`));
        done(-1, false);
      }
    });

    child.on("close", (code) => {
      if (!settled) done(code ?? -1, false);
    });

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGKILL");
      done(-1, true);
    }, timeoutMs);
  });
}

/**
 * Normalize line endings to LF.
 */
function normalizeContent(content) {
  return (content ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Get nsjail config path for language.
 */
function getConfigPath(language) {
  const map = {
    java: "nsjail-java.cfg",
    python: "nsjail-python.cfg",
    cpp: "nsjail-cpp.cfg",
    javascript: "nsjail-javascript.cfg",
  };
  const file = map[language];
  if (!file) {
    throw new Error(`No nsjail config for language: ${language}`);
  }
  return path.join(NSJAIL_CONFIG_DIR, file);
}

// ─── Workspace Management ───────────────────────────────────────────────────────

/**
 * Create a unique workspace directory for this execution.
 */
async function createWorkspace() {
  const workspaceId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workspacePath = path.join(WORKSPACE_DIR, workspaceId);
  await fs.mkdir(workspacePath, { recursive: true });
  return { id: workspaceId, path: workspacePath };
}

/**
 * Write submission files to workspace.
 */
async function writeFiles(workspacePath, fileList) {
  await Promise.all(
    fileList.map(async (file) => {
      const dest = path.join(workspacePath, file.name);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, normalizeContent(file.content), "utf-8");
    }),
  );
}

/**
 * Clear workspace after execution.
 */
async function cleanupWorkspace(workspacePath) {
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
  } catch (err) {
    console.error("[nsjailExecutor] cleanup error:", err.message);
  }
}

// ─── Java Execution ────────────────────────────────────────────────────────────

/**
 * Execute Java submission with nsjail sandbox.
 * Returns { results, status, passedCount }
 */
export async function executeJavaWithNsjail(submission, testCases) {
  // Acquire semaphore slot
  await semaphore.acquire();

  let workspace = null;
  try {
    // ─── 1. Create workspace and validate files ────────────────────────────────
    workspace = await createWorkspace();

    const fileList =
      submission.files?.length > 0
        ? submission.files
        : [
            {
              name: submission.mainFile || "Main.java",
              content: submission.code || "",
            },
          ];

    for (const file of fileList) {
      if (!validateFileName(file.name)) {
        throw new Error(`Invalid file name rejected: "${file.name}"`);
      }
    }

    // ─── 2. Write source files to workspace ───────────────────────────────────
    await writeFiles(workspace.path, fileList);

    const studentFile = path.basename(submission.mainFile || "Main.java");
    const testRunFile = submission.testRunFile
      ? path.basename(submission.testRunFile)
      : null;

    // ─── 3. Compile student code (inside nsjail) ───────────────────────────────
    const javaConfig = getConfigPath("java");

    const compileResult = await execNsjail(
      workspace.path,
      javaConfig,
      [JAVAC_BIN, studentFile],
      COMPILE_TIMEOUT,
    );

    if (compileResult.timedOut || compileResult.exitCode !== 0) {
      const errorMsg = compileResult.timedOut
        ? "Compilation timeout (exceeded 10s)"
        : compileResult.stderr || compileResult.stdout || "Unknown compile error";

      return {
        results: [
          {
            testcaseId: "compile",
            passed: false,
            executionTime: 0,
            output: "",
            error: errorMsg,
          },
        ],
        status: "compile_error",
        passedCount: 0,
      };
    }

    // ─── 4. Compile grader file if provided ───────────────────────────────────
    if (testRunFile && testRunFile !== studentFile) {
      const graderCompile = await execNsjail(
        workspace.path,
        javaConfig,
        [JAVAC_BIN, testRunFile],
        COMPILE_TIMEOUT,
      );

      if (graderCompile.timedOut || graderCompile.exitCode !== 0) {
        const errorMsg = graderCompile.timedOut
          ? "Grader compilation timeout (exceeded 10s)"
          : graderCompile.stderr || graderCompile.stdout || "Unknown compile error";

        return {
          results: [
            {
              testcaseId: "compile",
              passed: false,
              executionTime: 0,
              output: "",
              error: errorMsg,
            },
          ],
          status: "compile_error",
          passedCount: 0,
        };
      }
    }

    // ─── 5. Run test cases ────────────────────────────────────────────────────
    const entryClass = (testRunFile ?? studentFile).replace(/\.java$/, "");
    const results = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = Date.now();

      // Write input file
      const inputFile = path.join(workspace.path, `__input_${i}__.txt`);
      await fs.writeFile(inputFile, normalizeContent(tc.input ?? ""), "utf-8");

      // Run inside nsjail with input redirection
      const inputPath = NSJAIL_DISABLE_NEWNS ? `__input_${i}__.txt` : `/workspace/__input_${i}__.txt`;
      const runResult = await execNsjail(
        workspace.path,
        javaConfig,
        ["/bin/sh", "-c", `${JAVA_BIN} ${entryClass} < ${inputPath}`],
        RUN_TIMEOUT,
      );

      const executionTime = Date.now() - startTime;
      const actualOutput = runResult.stdout.replace(/\r/g, "").trimEnd();
      const expectedOutput = (tc.expectedOutput ?? "").replace(/\r/g, "").trimEnd();
      const passed = !runResult.timedOut && runResult.exitCode === 0 && actualOutput === expectedOutput;

      if (passed) passedCount++;

      let errorMsg = "";
      if (runResult.timedOut) {
        errorMsg = `Time limit exceeded (timeout after ${RUN_TIMEOUT / 1000}s)`;
      } else if (runResult.exitCode !== 0) {
        errorMsg = runResult.stderr || `Process exited with code ${runResult.exitCode}`;
      }

      results.push({
        testcaseId: tc._id?.toString() ?? String(i),
        passed,
        executionTime,
        output: runResult.stdout,
        error: errorMsg,
      });
    }

    // ─── 6. Aggregate status ──────────────────────────────────────────────────
    let status;
    if (results.some((r) => r.error?.includes("Time limit exceeded"))) {
      status = "time_limit_exceeded";
    } else if (results.some((r) => r.error?.length > 0)) {
      status = "runtime_error";
    } else if (passedCount === testCases.length) {
      status = "accepted";
    } else {
      status = "wrong_answer";
    }

    return { results, status, passedCount };
  } catch (error) {
    console.error("[nsjailExecutor] Java execution error:", error);
    return {
      results: [
        {
          testcaseId: "execute",
          passed: false,
          executionTime: 0,
          output: "",
          error: error.message,
        },
      ],
      status: "runtime_error",
      passedCount: 0,
    };
  } finally {
    if (workspace) {
      await cleanupWorkspace(workspace.path);
    }
    semaphore.release();
  }
}

// ─── Python Execution ──────────────────────────────────────────────────────────

/**
 * Execute Python submission with nsjail sandbox.
 * Returns { results, status, passedCount }
 */
export async function executePythonWithNsjail(submission, testCases) {
  // Acquire semaphore slot
  await semaphore.acquire();

  let workspace = null;
  try {
    // ─── 1. Create workspace and validate files ────────────────────────────────
    workspace = await createWorkspace();

    const fileList =
      submission.files?.length > 0
        ? submission.files
        : [
            {
              name: submission.mainFile || "main.py",
              content: submission.code || "",
            },
          ];

    for (const file of fileList) {
      if (!validateFileName(file.name)) {
        throw new Error(`Invalid file name rejected: "${file.name}"`);
      }
    }

    // ─── 2. Write source files to workspace ───────────────────────────────────
    await writeFiles(workspace.path, fileList);

    const mainFile = path.basename(submission.mainFile || "main.py");
    const pythonConfig = getConfigPath("python");

    // ─── 3. Run test cases ────────────────────────────────────────────────────
    const results = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = Date.now();

      // Write input file
      const inputFile = path.join(workspace.path, `__input_${i}__.txt`);
      await fs.writeFile(inputFile, normalizeContent(tc.input ?? ""), "utf-8");

      // Run inside nsjail with stdin redirection, matching normal contest input.
      const inputPath = NSJAIL_DISABLE_NEWNS ? `__input_${i}__.txt` : `/workspace/__input_${i}__.txt`;
      const runResult = await execNsjail(
        workspace.path,
        pythonConfig,
        ["/bin/sh", "-c", `${PYTHON_BIN} ${mainFile} < ${inputPath}`],
        RUN_TIMEOUT,
      );

      const executionTime = Date.now() - startTime;
      const actualOutput = runResult.stdout.replace(/\r/g, "").trimEnd();
      const expectedOutput = (tc.expectedOutput ?? "").replace(/\r/g, "").trimEnd();
      const passed = !runResult.timedOut && runResult.exitCode === 0 && actualOutput === expectedOutput;

      if (passed) passedCount++;

      let errorMsg = "";
      if (runResult.timedOut) {
        errorMsg = `Time limit exceeded (timeout after ${RUN_TIMEOUT / 1000}s)`;
      } else if (runResult.exitCode !== 0) {
        errorMsg = runResult.stderr || `Process exited with code ${runResult.exitCode}`;
      }

      results.push({
        testcaseId: tc._id?.toString() ?? String(i),
        passed,
        executionTime,
        output: runResult.stdout,
        error: errorMsg,
      });
    }

    // ─── 4. Aggregate status ───────────────────────────────────────────────────
    let status;
    if (results.some((r) => r.error?.includes("Time limit exceeded"))) {
      status = "time_limit_exceeded";
    } else if (results.some((r) => r.error?.length > 0)) {
      status = "runtime_error";
    } else if (passedCount === testCases.length) {
      status = "accepted";
    } else {
      status = "wrong_answer";
    }

    return { results, status, passedCount };
  } catch (error) {
    console.error("[nsjailExecutor] Python execution error:", error);
    return {
      results: [
        {
          testcaseId: "execute",
          passed: false,
          executionTime: 0,
          output: "",
          error: error.message,
        },
      ],
      status: "runtime_error",
      passedCount: 0,
    };
  } finally {
    if (workspace) {
      await cleanupWorkspace(workspace.path);
    }
    semaphore.release();
  }
}

/**
 * Initialize the executor (create workspace directory).
 */
export async function initNsjailExecutor() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  console.log(`[nsjailExecutor] initialized, workspace: ${WORKSPACE_DIR}`);
}

/**
 * Cleanup function (for graceful shutdown).
 */
export async function cleanupNsjailExecutor() {
  // Nothing to cleanup for nsjail - semaphore will drain naturally
  console.log("[nsjailExecutor] cleanup complete");
}

// ─── Helpers shared by the C++/JavaScript executors below ────────────────────

const FILE_EXTRA_FLAGS = {
  cpp: {
    compiler: "/usr/bin/g++",
    compileArgs: (mainFile) => ["g++", mainFile, "-o", "main", "-std=c++17"],
    runtime: () => ["./main"],
    timeoutMs: COMPILE_TIMEOUT,
  },
  javascript: {
    compiler: null,
    compileArgs: null,
    runtime: (mainFile) => ["/usr/bin/node", mainFile],
    timeoutMs: 0,
  },
};

async function writeTestInput(workspacePath, i, input) {
  const inputFile = path.join(workspacePath, `__input_${i}__.txt`);
  await fs.writeFile(inputFile, normalizeContent(input ?? ""), "utf-8");
  return inputFile;
}

function buildRunResult({ runResult, startTime, expected, passOnAnyNonZero }) {
  const executionTime = Date.now() - startTime;
  const actualOutput = (runResult.stdout ?? "").replace(/\r/g, "").trimEnd();
  const expectedOutput = (expected ?? "").replace(/\r/g, "").trimEnd();
  const passed = !runResult.timedOut &&
    (passOnAnyNonZero ? runResult.exitCode === 0 : actualOutput === expectedOutput);
  let errorMsg = "";
  if (runResult.timedOut) {
    errorMsg = `Time limit exceeded (timeout after ${runResult.timeoutMs / 1000}s)`;
  } else if (runResult.exitCode !== 0) {
    errorMsg = runResult.stderr || `Process exited with code ${runResult.exitCode}`;
  }
  return {
    executionTime,
    actualOutput,
    expectedOutput,
    passed,
    errorMsg,
    stdout: runResult.stdout,
  };
}

/**
 * Generic compiled-language executor (currently used by C++).
 * Two-stage: compile inside nsjail, then run each test case inside nsjail.
 */
async function executeCompiledLanguage({ submission, testCases, language }) {
  const config = FILE_EXTRA_FLAGS[language];
  if (!config || !config.compiler) {
    throw new Error(`Compiled executor not configured for ${language}`);
  }
  await semaphore.acquire();
  let workspace = null;
  try {
    workspace = await createWorkspace();

    const fileList =
      submission.files?.length > 0
        ? submission.files
        : [{ name: submission.mainFile, content: submission.code || "" }];
    for (const file of fileList) {
      if (!validateFileName(file.name)) {
        throw new Error(`Invalid file name rejected: "${file.name}"`);
      }
    }
    await writeFiles(workspace.path, fileList);

    const mainFile = path.basename(submission.mainFile);
    const langConfig = getConfigPath(language);

    // Compile in nsjail using argv-only invocation
    const compileResult = await execNsjail(
      workspace.path,
      langConfig,
      config.compileArgs(mainFile),
      COMPILE_TIMEOUT,
    );

    if (compileResult.timedOut || compileResult.exitCode !== 0) {
      const errorMsg = compileResult.timedOut
        ? "Compilation timeout"
        : compileResult.stderr || compileResult.stdout || "Unknown compile error";
      return {
        results: [
          {
            testcaseId: "compile",
            passed: false,
            executionTime: 0,
            output: "",
            error: errorMsg,
          },
        ],
        status: "compile_error",
        passedCount: 0,
      };
    }

    const results = [];
    let passedCount = 0;
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = Date.now();
      await writeTestInput(workspace.path, i, tc.input);

      const runResult = await execNsjail(
        workspace.path,
        langConfig,
        config.runtime(mainFile),
        RUN_TIMEOUT,
      );
      runResult.timeoutMs = RUN_TIMEOUT;

      const r = buildRunResult({
        runResult,
        startTime,
        expected: tc.expectedOutput,
        passOnAnyNonZero: false,
      });
      if (r.passed) passedCount++;
      results.push({
        testcaseId: tc._id?.toString() ?? String(i),
        passed: r.passed,
        executionTime: r.executionTime,
        output: r.stdout,
        error: r.errorMsg,
      });
    }

    const status = (() => {
      if (results.some((r) => r.error?.includes("Time limit exceeded"))) return "time_limit_exceeded";
      if (results.some((r) => r.error?.length > 0)) return "runtime_error";
      if (passedCount === testCases.length) return "accepted";
      return "wrong_answer";
    })();

    return { results, status, passedCount };
  } finally {
    if (workspace) await cleanupWorkspace(workspace.path);
    semaphore.release();
  }
}

/**
 * Interpreted-language executor (currently used by JavaScript / Node.js).
 * Single-stage: write source, then run each test inside nsjail.
 */
async function executeInterpretedLanguage({ submission, testCases, language }) {
  const config = FILE_EXTRA_FLAGS[language];
  if (!config || !config.runtime) {
    throw new Error(`Interpreted executor not configured for ${language}`);
  }
  await semaphore.acquire();
  let workspace = null;
  try {
    workspace = await createWorkspace();

    const fileList =
      submission.files?.length > 0
        ? submission.files
        : [{ name: submission.mainFile, content: submission.code || "" }];
    for (const file of fileList) {
      if (!validateFileName(file.name)) {
        throw new Error(`Invalid file name rejected: "${file.name}"`);
      }
    }
    await writeFiles(workspace.path, fileList);

    const mainFile = path.basename(submission.mainFile);
    const langConfig = getConfigPath(language);
    const results = [];
    let passedCount = 0;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = Date.now();
      await writeTestInput(workspace.path, i, tc.input);

      const runResult = await execNsjail(
        workspace.path,
        langConfig,
        config.runtime(mainFile),
        RUN_TIMEOUT,
      );
      runResult.timeoutMs = RUN_TIMEOUT;

      const r = buildRunResult({
        runResult,
        startTime,
        expected: tc.expectedOutput,
        passOnAnyNonZero: false,
      });
      if (r.passed) passedCount++;
      results.push({
        testcaseId: tc._id?.toString() ?? String(i),
        passed: r.passed,
        executionTime: r.executionTime,
        output: r.stdout,
        error: r.errorMsg,
      });
    }

    const status = (() => {
      if (results.some((r) => r.error?.includes("Time limit exceeded"))) return "time_limit_exceeded";
      if (results.some((r) => r.error?.length > 0)) return "runtime_error";
      if (passedCount === testCases.length) return "accepted";
      return "wrong_answer";
    })();

    return { results, status, passedCount };
  } finally {
    if (workspace) await cleanupWorkspace(workspace.path);
    semaphore.release();
  }
}

/**
 * Public entry point for C++ submissions. Replaces the legacy `execAsync`
 * path that ran code outside the sandbox.
 */
export async function executeCppWithNsjail(submission, testCases) {
  return executeCompiledLanguage({ submission, testCases, language: "cpp" });
}

/**
 * Public entry point for JavaScript submissions. Replaces the legacy
 * `node main.js` path that ran outside the sandbox.
 */
export async function executeJavaScriptWithNsjail(submission, testCases) {
  return executeInterpretedLanguage({ submission, testCases, language: "javascript" });
}

// Re-export helpers used by `codeExecutor.js` tests and the production path.
export { validateFileName };
