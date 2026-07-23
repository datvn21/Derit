import { test, expect } from "@playwright/test";

/**
 * E2E for the lecturer dashboard and management pages. Until a real
 * authenticated fixture exists, these tests verify redirect behaviour
 * for unauthenticated users. See `verifications/characterization` for
 * the future authenticated journeys.
 */
test.describe("Lecturer app — unauthenticated", () => {
  for (const path of [
    "/lecturer",
    "/lecturer/exam-templates",
    "/lecturer/exam-sessions",
    "/lecturer/classrooms",
  ]) {
    test(`redirects ${path} to login`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page).not.toHaveURL(/\/lecturer(\/|$)/);
    });
  }
});
