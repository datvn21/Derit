#!/usr/bin/env node
/**
 * Standalone unit tests for pure modules: `policy.js`, `bounded.js`,
 * `codeExecutor.js`. Run with: `node tests/unit-runner.mjs`.
 *
 * This avoids the Jest ESM/VM-modules interplay that breaks the current
 * Jest configuration. Each test group is independent and exits non-zero on
 * failure so CI can gate on it.
 */

import assert from "node:assert/strict";

import { normalizeEmails } from "../src/services/studentEmail.js";
import { BoundedCache, KeyedRateLimiter } from "../src/services/bounded.js";
import {
  buildExecutionFileList,
  executeCodeLocally,
} from "../src/services/codeExecutor.js";
import {
  aggregateFinalScore,
  buildQuestionSubmission,
  computeQuestionScore,
  normalizeLineEndings,
  pickLatestTestResults,
} from "../src/services/grading.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ok  ${name}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  FAIL ${name}`);
      console.error(err.stack || err.message);
      failed++;
    });
}

async function run() {
  console.log("KeyedRateLimiter");
  await test("stops allowing after the limit is hit", () => {
    const limiter = new KeyedRateLimiter({
      limit: 3,
      windowMs: 1000,
      maxEntries: 100,
    });
    limiter.hit("u1", 0);
    limiter.hit("u1", 1);
    const lastAllowed = limiter.hit("u1", 2);
    assert.equal(lastAllowed.allowed, true);
    const blocked = limiter.hit("u1", 3);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0);
    limiter.stop();
  });

  await test("sweeps expired entries", () => {
    const limiter = new KeyedRateLimiter({
      limit: 1,
      windowMs: 10,
      maxEntries: 100,
    });
    limiter.hit("k1", 0);
    assert.equal(limiter.size(), 1);
    limiter._sweep(1000);
    assert.equal(limiter.size(), 0);
    limiter.stop();
  });

  await test("evicts oldest entries when capacity exceeded", () => {
    const limiter = new KeyedRateLimiter({
      limit: 1,
      windowMs: 1000,
      maxEntries: 2,
    });
    limiter.hit("a", 0);
    limiter.hit("b", 0);
    limiter.hit("c", 0);
    assert.equal(limiter.has("a"), false);
    limiter.stop();
  });

  console.log("BoundedCache");
  await test("expires entries by TTL", async () => {
    const cache = new BoundedCache({ maxEntries: 10, ttlMs: 20 });
    cache.set("a", 1);
    assert.equal(cache.get("a"), 1);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(cache.get("a"), undefined);
  });

  await test("evicts oldest when capacity exceeded", () => {
    const cache = new BoundedCache({ maxEntries: 2, ttlMs: 1000 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    assert.equal(cache.has("a"), false);
    assert.equal(cache.has("b"), true);
    assert.equal(cache.has("c"), true);
  });

  console.log("codeExecutor - buildExecutionFileList");
  await test("rejects path traversal", () => {
    assert.throws(() =>
      buildExecutionFileList({
        language: "python",
        mainFile: "main.py",
        code: "x",
        files: [{ name: "../x.py", content: "x" }],
      }),
    );
  });

  await test("rejects extension-mismatched main files", () => {
    assert.throws(() =>
      buildExecutionFileList({
        language: "java",
        mainFile: "evil.js",
        code: "x",
      }),
    );
  });

  await test("uses default filename when no files are supplied", () => {
    const out = buildExecutionFileList({
      language: "java",
      mainFile: "Main.java",
      code: "",
    });
    assert.equal(out.fileList[0].name, "Main.java");
  });

  await test("rejects unsupported languages at the dispatch boundary", async () => {
    const out = await executeCodeLocally(
      { language: "rust", mainFile: "main.rs", code: "fn main(){}" },
      [],
    );
    assert.equal(out.status, "compile_error");
    assert.match(out.results[0].error, /Unsupported language/);
  });

  console.log("content normalisers");
  await test("normalises CRLF in code", () => {
    assert.equal(normalizeLineEndings("a\r\nb\rc\n"), "a\nb\nc\n");
  });

  console.log("email normaliser");
  await test("adds the student domain to bare ids", () => {
    assert.deepEqual(normalizeEmails(["alice", "bob@school.vn", "  ", ""]), [
      "alice@student.tdtu.edu.vn",
      "bob@school.vn",
    ]);
  });

  await test("deduplicates results", () => {
    assert.deepEqual(normalizeEmails(["alice", "alice", "alice@school.vn"]), [
      "alice@student.tdtu.edu.vn",
      "alice@school.vn",
    ]);
  });

  console.log("grading service");
  await test("computeQuestionScore is 100 when all pass", () => {
    assert.equal(
      computeQuestionScore([
        { passed: true },
        { passed: true },
        { passed: true },
      ]),
      100,
    );
  });

  await test("computeQuestionScore returns 0 for empty input", () => {
    assert.equal(computeQuestionScore([]), 0);
  });

  await test("computeQuestionScore handles partial pass", () => {
    assert.equal(
      computeQuestionScore([
        { passed: true },
        { passed: false },
        { passed: false },
      ]),
      33,
    );
  });

  await test("aggregateFinalScore respects points weighting", () => {
    const out = aggregateFinalScore([
      { points: 10, testResults: [{ passed: true }, { passed: true }] },
      { points: 5, testResults: [{ passed: true }, { passed: false }] },
    ]);
    assert.equal(out, 12.5);
  });

  await test("buildQuestionSubmission normalises files and falls back to mainFile content", () => {
    const q = buildQuestionSubmission({
      questionNumber: 7,
      code: "",
      files: [{ name: "Main.java", content: "class Main {\r\n}\r\n" }],
      mainFile: "Main.java",
      language: "java",
    });
    assert.equal(q.language, "java");
    assert.equal(q.files[0].content, "class Main {\n}\n");
    assert.equal(q.code, "class Main {\n}\n");
  });

  await test("pickLatestTestResults returns the final run only", () => {
    const out = pickLatestTestResults([
      [{ testCaseId: "0", passed: true }],
      [{ testCaseId: "0", passed: false }],
    ]);
    assert.equal(out[0].passed, false);
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

run();
