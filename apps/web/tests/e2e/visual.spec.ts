import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";

test.describe("Visual regression", () => {
  test("captures stable desktop baselines for critical dashboards", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    await mockBackend(page, "student");
    await page.goto("/student");
    await expect(page.getByRole("heading", { name: /Welcome, Nguyen Van An/i })).toBeVisible();
    await expect(page).toHaveScreenshot("student-dashboard.png", {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });

    await mockBackend(page, "lecturer");
    await page.goto("/lecturer/exam-sessions/session-1/results");
    await expect(page.getByRole("heading", { name: "Java Midterm Room 101" })).toBeVisible();
    await expect(page).toHaveScreenshot("lecturer-results.png", {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
  });
});
