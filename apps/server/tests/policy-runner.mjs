#!/usr/bin/env node
/**
 * Standalone unit tests for the policy middleware. Run with:
 *   `node tests/policy-runner.mjs`
 *
 * Avoids the Jest ESM/VM-modules issue.
 */
import assert from "node:assert/strict";

import {
  PERMISSIONS,
  requireAuth,
} from "../src/middleware/policy.js";

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

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function run() {
  console.log("PERMISSIONS");
  await test("exposes canonical permission codes", () => {
    assert.equal(PERMISSIONS.USERS_PROMOTE, "users:promote");
    assert.equal(PERMISSIONS.SETTINGS_WRITE, "settings:write");
    assert.equal(PERMISSIONS.LOGS_READ, "logs:read");
  });

  console.log("requireAuth");
  await test("rejects when isAuthenticated() is false", () => {
    const res = mockRes();
    requireAuth({ isAuthenticated: () => false }, res, () => {
      throw new Error("next should not run");
    });
    assert.equal(res.statusCode, 401);
    assert.ok(res.body && res.body.error);
  });

  await test("rejects when isAuthenticated is missing", () => {
    const res = mockRes();
    requireAuth({}, res, () => {
      throw new Error("next should not run");
    });
    assert.equal(res.statusCode, 401);
  });

  await test("passes through when isAuthenticated() returns true", () => {
    let called = false;
    requireAuth({ isAuthenticated: () => true }, mockRes(), () => { called = true; });
    assert.equal(called, true);
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

run();
