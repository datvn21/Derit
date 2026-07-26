import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-real",
  timeout: 120 * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    headless: false,
    launchOptions: {
      slowMo: Number(process.env.E2E_SLOW_MO || 1000),
    },
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
    : [
        {
          command: "cd ../.. && E2E_TEST_MODE=true npm --workspace apps/server run dev",
          url: "http://localhost:5001",
          reuseExistingServer: !process.env.CI,
          timeout: 180 * 1000,
          stdout: "ignore",
          stderr: "pipe",
        },
        {
          command: "npm run dev",
          url: "http://localhost:5173",
          reuseExistingServer: !process.env.CI,
          timeout: 180 * 1000,
          stdout: "ignore",
          stderr: "pipe",
        },
      ],
});
