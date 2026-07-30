import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// WORKAROUND ONLY — see note.
//
// `vite.config.ts` loads `reactRouter()` which triggers `@react-router/dev`
// to run `typegen` on every Vite start. Typegen does
//   rm(<root>/.react-router/types, { recursive, force })
// and in this dev container the cache is owned by `root`, so the rm fails
// and every test run aborts with EACCES before any test executes.
//
// Use this config when the cache is unwriteable:
//   npx vitest run --config ./vitest.standalone.config.ts
//
// For everyone else, `npx vitest run` (which uses vite.config.ts) works
// normally. Delete this file once the cache ownership issue is resolved
// (e.g. `sudo chown -R $USER: apps/web/.react-router`).
export default defineConfig({
  plugins: [tsconfigPaths(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
