/**
 * Jest configuration.
 *
 * The server is ESM-only (`"type": "module"` in package.json), so we configure
 * Jest to use its built-in ESM support via `--experimental-vm-modules`.
 *
 * Notes:
 *  - We rely on `npm test` setting NODE_OPTIONS=--experimental-vm-modules
 *    (and on package.json `scripts.test` doing it). Tests must keep `.js`
 *    extensions in their relative imports.
 *  - `transform: {}` keeps Jest from rewriting modules; Node resolves imports
 *    natively under VM modules.
 */
export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  moduleFileExtensions: ["js", "mjs", "json"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.d.js",
  ],
  coverageDirectory: "coverage",
  setupFiles: ["<rootDir>/tests/setup.js"],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
