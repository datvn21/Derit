import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Derit E2E.
 *
 * The dev server boots via `npm run dev` which uses Vite's default port
 * (5173). `baseURL` should resolve to the live URL regardless of which port
 * Vite actually picks — we let `webServer.url` drive that discovery.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        stdout: "ignore",
        stderr: "pipe",
      },
});

