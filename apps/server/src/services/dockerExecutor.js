import Docker from "dockerode";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POOL_BASE_DIR =
  process.env.POOL_BASE_DIR || path.join(__dirname, "../../temp/pool");
const DOCKER_IMAGE = process.env.DOCKER_IMAGE || "derit-java-runner:latest";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
const COMPILE_TIMEOUT = parseInt(process.env.DOCKER_COMPILE_TIMEOUT) || 10000; // 10s
const RUN_TIMEOUT = parseInt(process.env.DOCKER_TIMEOUT) || 5000; // 5s per testcase
const MEMORY_LIMIT = process.env.DOCKER_MEMORY_LIMIT || "128m";
const POOL_SIZE = parseInt(process.env.POOL_SIZE) || 10;
const QUEUE_TIMEOUT_MS = parseInt(process.env.POOL_QUEUE_TIMEOUT) || 30_000;
const POOL_LABEL = "derit.pool";

/**
 * Parse memory string like "256m" → bytes
 */
function parseMemoryBytes(memStr) {
  const match = String(memStr).match(/^(\d+)([kmg]?)$/i);
  if (!match) return 256 * 1024 * 1024;
  const value = parseInt(match[1]);
  switch (match[2].toLowerCase()) {
    case "k":
      return value * 1024;
    case "m":
      return value * 1024 * 1024;
    case "g":
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

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
 * Lazily create Docker client. Throws a clear error if Docker is unavailable.
 */
let _docker = null;
function getDockerClient() {
  if (!_docker) {
    // On Linux/Ubuntu: connect via Unix socket. Use DOCKER_SOCKET env to override.
    _docker =
      process.platform === "win32"
        ? new Docker() // Windows: named pipe
        : new Docker({ socketPath: DOCKER_SOCKET });
  }
  return _docker;
}

/**
 * Execute a shell command inside a running container using dockerode's native
 * exec API — no Docker CLI subprocess required.
 *
 * Cross-platform: works on Linux (Unix socket) and Windows (named pipe) without
 * needing `docker` in PATH.
 *
 * Signal isolation: the shell wrapper `trap '' INT TERM` prevents SIGINT/SIGTERM
 * generated inside the container from propagating back through the socket
 * connection to the Node.js process — replacing the previous `detached` process
 * group trick which was Unix-only.
 *
 * Returns { stdout, stderr, exitCode, timedOut }
 */
async function execInContainer(container, cmd, timeoutMs) {
  return new Promise(async (resolve) => {
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

    // Wrap with signal trap so SIGINT/SIGTERM from the container process cannot
    // escape to our Node event loop through the open socket stream.
    let execInstance;
    try {
      execInstance = await container.exec({
        Cmd: ["sh", "-c", `trap '' INT TERM; ${cmd}`],
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: false,
        Tty: false,
      });
    } catch (err) {
      return resolve({
        stdout: "",
        stderr: `[exec create error] ${err.message}`,
        exitCode: -1,
        timedOut: false,
      });
    }

    let stream;
    try {
      stream = await execInstance.start({ hijack: true, stdin: false });
    } catch (err) {
      return resolve({
        stdout: "",
        stderr: `[exec start error] ${err.message}`,
        exitCode: -1,
        timedOut: false,
      });
    }

    // Demultiplex the Docker multiplexed stream into stdout / stderr
    container.modem.demuxStream(
      stream,
      {
        write: (chunk) =>
          stdoutChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
          ),
      },
      {
        write: (chunk) =>
          stderrChunks.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
          ),
      },
    );

    const timer = setTimeout(async () => {
      if (settled) return;
      stream.destroy();
      // Best-effort: kill any lingering java/javac processes in the container
      try {
        const killExec = await container.exec({
          Cmd: [
            "sh",
            "-c",
            "kill -9 $(pgrep -x java 2>/dev/null; pgrep -x javac 2>/dev/null) 2>/dev/null || true",
          ],
          AttachStdout: false,
          AttachStderr: false,
        });
        await killExec.start({ hijack: false, stdin: false }).catch(() => {});
      } catch (_) {}
      done(-1, true);
    }, timeoutMs);

    stream.on("end", async () => {
      if (settled) return;
      try {
        const info = await execInstance.inspect();
        done(info.ExitCode ?? 0, false);
      } catch (_) {
        done(0, false);
      }
    });

    stream.on("error", (err) => {
      if (!settled) {
        stderrChunks.push(Buffer.from(`\n[stream error] ${err.message}`));
        done(-1, false);
      }
    });
  });
}

// ─── ContainerPool ────────────────────────────────────────────────────────────
/**
 * Pre-warmed pool of isolated Docker containers.
 *
 * Each slot owns:
 *  - a running container  (kept alive via `sleep infinity`)
 *  - a dedicated host directory  (bind-mounted to /workspace inside the container)
 *
 * acquire() → Promise<slot>  blocks if all slots are busy, up to QUEUE_TIMEOUT_MS
 * release(slot) → clears workspace, returns slot to pool (or hands to next waiter)
 *
 * If a container dies (OOM / crash) it is automatically recreated on release.
 */
class ContainerPool {
  constructor(size) {
    this.size = size;
    this.available = []; // idle slots: { container, hostDir, index }
    this.queue = []; // waiting callers: { resolve, reject, timer }
    this._initPromise = null;
    this._capsProbed = false;
    this._useMemorySwap = true;
    this._usePidsLimit = true;
  }

  init() {
    if (!this._initPromise) this._initPromise = this._initialize();
    return this._initPromise;
  }

  async _initialize() {
    const docker = getDockerClient();
    const memBytes = parseMemoryBytes(MEMORY_LIMIT);
    await fs.mkdir(POOL_BASE_DIR, { recursive: true });

    // 1. Check Docker daemon is reachable
    try {
      await docker.ping();
      console.log("[ContainerPool] Docker daemon reachable ✓");
    } catch (err) {
      throw new Error(
        `[ContainerPool] Cannot reach Docker daemon (socket: ${DOCKER_SOCKET}).\n` +
          `  On Ubuntu, ensure the user is in the 'docker' group:\n` +
          `    sudo usermod -aG docker $USER && newgrp docker\n` +
          `  Original error: ${err.message}`,
      );
    }

    // 2. Verify sandbox image exists
    try {
      await docker.getImage(DOCKER_IMAGE).inspect();
      console.log(`[ContainerPool] sandbox image "${DOCKER_IMAGE}" found ✓`);
    } catch {
      throw new Error(
        `[ContainerPool] Sandbox image "${DOCKER_IMAGE}" not found.\n` +
          `  Build it first (run inside derit-be directory):\n` +
          `    docker build -t derit-java-runner .`,
      );
    }

    // 3. Probe kernel capabilities (MemorySwap, PidsLimit) once before creating slots
    await this._probeKernelCaps(docker);

    // Cleanup old containers from previous runs
    await this._cleanupOldContainers(docker);

    const settled = await Promise.allSettled(
      Array.from({ length: this.size }, (_, i) =>
        this._createSlot(docker, i, memBytes),
      ),
    );

    for (const r of settled) {
      if (r.status === "fulfilled") {
        this.available.push(r.value);
      } else {
        console.error("[ContainerPool] slot init error:", r.reason?.message);
      }
    }

    if (this.available.length === 0) {
      throw new Error("ContainerPool: failed to initialize any containers");
    }
    console.log(
      `[ContainerPool] ready — ${this.available.length}/${this.size} containers`,
    );
  }

  // Detect which HostConfig features the kernel supports.
  // Some Ubuntu VPS kernels lack swapaccount or pids_cgroup — if so, disable those options.
  async _probeKernelCaps(docker) {
    if (this._capsProbed) return;
    this._capsProbed = true;
    this._useMemorySwap = true;
    this._usePidsLimit = true;

    // Try creating a throwaway container with all limits; if it fails, retry without each feature
    // Helper: create, start, poll-until-stopped, remove a probe container
    const runProbe = async (hostConfig) => {
      const probe = await docker.createContainer({
        Image: DOCKER_IMAGE,
        HostConfig: { ...hostConfig, AutoRemove: false },
        Cmd: ["true"],
      });
      await probe.start();
      // Poll inspect instead of .wait() to avoid long-poll socket connection
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const info = await probe.inspect().catch(() => null);
        if (info && !info.State?.Running) break;
      }
      await probe.remove({ force: true }).catch(() => {});
    };

    try {
      await runProbe({
        Memory: parseMemoryBytes(MEMORY_LIMIT),
        MemorySwap: parseMemoryBytes(MEMORY_LIMIT),
        PidsLimit: 50,
        NetworkMode: "none",
      });
      console.log("[ContainerPool] kernel caps: MemorySwap=yes, PidsLimit=yes");
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("swap") || msg.includes("memory")) {
        console.warn(
          "[ContainerPool] kernel does not support MemorySwap — disabling swap limit",
        );
        this._useMemorySwap = false;
      }
      if (msg.includes("pids") || msg.includes("pid")) {
        console.warn(
          "[ContainerPool] kernel does not support PidsLimit — disabling pids limit",
        );
        this._usePidsLimit = false;
      }
      // Re-probe to confirm at least base creation works
      if (!this._useMemorySwap || !this._usePidsLimit) {
        try {
          await runProbe({
            Memory: parseMemoryBytes(MEMORY_LIMIT),
            ...(this._useMemorySwap
              ? { MemorySwap: parseMemoryBytes(MEMORY_LIMIT) }
              : {}),
            ...(this._usePidsLimit ? { PidsLimit: 50 } : {}),
            NetworkMode: "none",
          });
        } catch (err2) {
          throw new Error(
            `[ContainerPool] Container creation failed even after disabling unsupported caps: ${err2.message}`,
          );
        }
      }
    }
  }

  async _cleanupOldContainers(docker) {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: { label: [POOL_LABEL] },
      });

      if (containers.length > 0) {
        console.log(
          `[ContainerPool] cleaning up ${containers.length} old containers...`,
        );
        await Promise.allSettled(
          containers.map(async (c) => {
            const container = docker.getContainer(c.Id);
            try {
              await container.stop({ t: 1 }).catch(() => {});
              await container.remove({ force: true });
            } catch (err) {
              console.error(
                `[ContainerPool] failed to remove ${c.Id.slice(0, 12)}:`,
                err.message,
              );
            }
          }),
        );
      }
    } catch (err) {
      console.error("[ContainerPool] cleanup error:", err.message);
    }
  }

  async _createSlot(docker, index, memBytes) {
    const hostDir = path.join(POOL_BASE_DIR, String(index));
    await fs.mkdir(hostDir, { recursive: true });
    // Allow the container's non-root user (runner uid=100) to write into the bind-mount
    await fs.chmod(hostDir, 0o777);

    const container = await docker.createContainer({
      Image: DOCKER_IMAGE,
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      NetworkDisabled: true,
      Labels: {
        [POOL_LABEL]: "true",
        "derit.pool.index": String(index),
      },
      HostConfig: {
        Binds: [`${hostDir}:/workspace:rw`],
        Memory: memBytes,
        // Only set MemorySwap / PidsLimit if the kernel supports them (probed at startup)
        ...(this._useMemorySwap ? { MemorySwap: memBytes } : {}),
        NanoCpus: 500_000_000, // 0.5 CPU
        ...(this._usePidsLimit ? { PidsLimit: 50 } : {}),
        NetworkMode: "none",
        AutoRemove: false,
      },
      WorkingDir: "/workspace",
      Cmd: ["sleep", "infinity"],
    });

    await container.start();
    return { container, hostDir, index };
  }

  // Returns a Promise<slot>. Rejects after QUEUE_TIMEOUT_MS if still waiting.
  acquire() {
    if (this.available.length > 0) {
      return Promise.resolve(this.available.pop());
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.queue.findIndex((q) => q.resolve === resolve);
        if (i >= 0) this.queue.splice(i, 1);
        reject(
          new Error(
            `ContainerPool: timed out waiting for a free slot after ${QUEUE_TIMEOUT_MS / 1000}s`,
          ),
        );
      }, QUEUE_TIMEOUT_MS);
      this.queue.push({ resolve, reject, timer });
    });
  }

  // Return slot after use.
  // Strategy: only delete __input_*.txt temp files — keep .java/.class so the
  // next caller can skip recompilation if the source hash matches (compile cache).
  // If the container died, clear everything and reset the compiled hash.
  async release(slot) {
    try {
      const entries = await fs.readdir(slot.hostDir).catch(() => []);
      const tempFiles = entries.filter(
        (e) => e.startsWith("__input_") && e.endsWith(".txt"),
      );
      await Promise.all(
        tempFiles.map((e) =>
          fs.rm(path.join(slot.hostDir, e), { force: true }),
        ),
      );
    } catch (err) {
      console.error("[ContainerPool] temp-file clear error:", err.message);
    }

    // Check the container is still alive; recreate if it crashed
    try {
      const info = await slot.container.inspect();
      if (!info.State?.Running) throw new Error("not running");
    } catch {
      console.warn(`[ContainerPool] slot ${slot.index} dead — recreating`);
      try {
        await slot.container.remove({ force: true }).catch(() => {});
        const docker = getDockerClient();
        const memBytes = parseMemoryBytes(MEMORY_LIMIT);
        const fresh = await this._createSlot(docker, slot.index, memBytes);
        slot.container = fresh.container;
        // workspace cleared on recreate
        // Also wipe any stale files from the old container's bind-mount
        try {
          const entries = await fs.readdir(slot.hostDir).catch(() => []);
          await Promise.all(
            entries.map((e) =>
              fs.rm(path.join(slot.hostDir, e), { recursive: true, force: true }),
            ),
          );
        } catch (_) {}
      } catch (err) {
        console.error("[ContainerPool] recreate failed:", err.message);
        return; // don't return a broken slot to the pool
      }
    }

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      clearTimeout(next.timer);
      next.resolve(slot);
    } else {
      this.available.push(slot);
    }
  }

  // Graceful shutdown
  async destroy() {
    for (const slot of this.available) {
      try {
        await slot.container.stop({ t: 1 });
      } catch (_) {}
      try {
        await slot.container.remove({ force: true });
      } catch (_) {}
    }
    this.available = [];
  }
}

// Module-level singleton
const pool = new ContainerPool(POOL_SIZE);

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a Java submission (multi-file) using a pooled container.
 *
 * @param {Object} submission  { code, language, files, mainFile, testRunFile? }
 *   files:       [{ name: "Main.java", content: "..." }, ...]
 *   mainFile:    student's entry .java (compiled first — catches student syntax errors)
 *   testRunFile: optional grader .java (compiled second, then run instead of mainFile)
 * @param {Array}  testCases   [{ _id, input, expectedOutput }]
 * @returns {Object} { results, status, passedCount }
 */
export async function executeJavaInDocker(submission, testCases) {
  await pool.init(); // no-op after first call

  const slot = await pool.acquire();

  try {
    // ─── 1. Build & validate file list ──────────────────────────────────────
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

    // ─── 1b. Clear stale .java/.class files before writing new ones ─────────
    try {
      const existing = await fs.readdir(slot.hostDir).catch(() => []);
      const staleSource = existing.filter(
        (e) => e.endsWith(".java") || e.endsWith(".class"),
      );
      await Promise.all(
        staleSource.map((e) => fs.rm(path.join(slot.hostDir, e), { force: true })),
      );
    } catch (_) {}

    // ─── 1c. Write all source files ──────────────────────────────────────────
    // Normalize line endings to LF before writing to Linux container.
    await Promise.all(
      fileList.map(async (file) => {
        const dest = path.join(slot.hostDir, file.name);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        const normalizedContent = (file.content ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        await fs.writeFile(dest, normalizedContent, "utf-8");
      }),
    );

    // ─── 2. Compile ──────────────────────────────────────────────────────────
    // When testRunFile is provided (grader scenario):
    //   Step 2a — compile student's mainFile first. This guarantees any student
    //             syntax / semantic error is always reported as a compile_error,
    //             even if the grader does not statically reference the student class
    //             (e.g. uses reflection or Runtime.exec).
    //   Step 2b — compile the grader testRunFile (only reached when student code is OK).
    // When no testRunFile, compile mainFile as the single entry point (javac resolves deps).
    const studentFile = path.basename(submission.mainFile || "Main.java");
    const testRunFile = submission.testRunFile
      ? path.basename(submission.testRunFile)
      : null;

    // Validate entry files exist in the file list
    if (!fileList.some((f) => path.basename(f.name) === studentFile))
      throw new Error(
        `Entry file "${studentFile}" not found in submission files`,
      );
    if (
      testRunFile &&
      !fileList.some((f) => path.basename(f.name) === testRunFile)
    )
      throw new Error(
        `Test run file "${testRunFile}" not found in submission files`,
      );

    // Helper: compile a single file and return an error response if it fails
    const compileFile = async (fileName) => {
      const result = await execInContainer(
        slot.container,
        `javac ${fileName}`,
        COMPILE_TIMEOUT,
      );
      if (result.timedOut || result.exitCode !== 0) {
        const errorMsg = result.timedOut
          ? "Compilation timeout (exceeded 10s)"
          : result.stderr || result.stdout || "Unknown compile error";
        return {
          failed: true,
          response: {
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
          },
        };
      }
      return { failed: false };
    };

    // Step 2a: compile student's file
    const studentCompile = await compileFile(studentFile);
    if (studentCompile.failed) return studentCompile.response;

    // Step 2b: compile grader file (if any) — only after student code passes
    if (testRunFile && testRunFile !== studentFile) {
      const graderCompile = await compileFile(testRunFile);
      if (graderCompile.failed) return graderCompile.response;
    }

    // The class to run: grader if provided, otherwise student's main class
    const entryFile = testRunFile ?? studentFile;

    // ─── 3. Write input files, then run each test case ───────────────────────
    // Input via shell redirect (< __input_N.txt) — far more reliable than
    // Docker exec stdin (a half-duplex hijacked stream whose end() closes both
    // directions, losing stdout before it is fully read).
    const mainClass = entryFile.replace(/\.java$/, "");

    // Write all input files in parallel
    await Promise.all(
      testCases.map((tc, i) =>
        fs.writeFile(
          path.join(slot.hostDir, `__input_${i}__.txt`),
          tc.input ?? "",
          "utf-8",
        ),
      ),
    );

    const results = [];
    let passedCount = 0;
    // testRunFile = grader acts as alternative main (calls student methods, produces output)
    // runClass = the class whose main() is invoked; compare its stdout to expectedOutput
    const runClass = (testRunFile ?? studentFile).replace(/\.java$/, "");

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const startTime = Date.now();

      const runResult = await execInContainer(
        slot.container,
        `java -Xmx128m -Xms16m -XX:-UsePerfData ${runClass} < /workspace/__input_${i}__.txt`,
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

    // ─── 4. Aggregate status ─────────────────────────────────────────────────
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
  } finally {
    // Always release — pool.release() clears the workspace for next use
    await pool.release(slot);
  }
}

/**
 * Cleanup all containers in the pool (for graceful shutdown).
 */
export async function cleanupDockerPool() {
  await pool.destroy();
}
