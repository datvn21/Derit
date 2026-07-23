import { test, expect } from "@playwright/test";

test.describe("Student Exam Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Note: These tests require authenticated session
    // In a real setup, you would use storageState or API to authenticate
  });

  test("should display available exams", async ({ page }) => {
    // Navigate to student dashboard
    await page.goto("/student");
    
    // Should show available sessions or loading state
    await expect(
      page.getByText(/available exams/i).or(page.getByText(/loading/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test("should search for exam by room code", async ({ page }) => {
    await page.goto("/student");
    
    // Look for room code input
    const roomCodeInput = page.getByPlaceholder(/room code/i);
    if (await roomCodeInput.isVisible()) {
      await roomCodeInput.fill("TESTROOM");
      await page.getByRole("button", { name: /search|find/i }).click();
    }
    
    // Should show search result or error
    await expect(
      page.getByText(/not found/i).or(page.getByText(/session found/i))
    ).toBeVisible({ timeout: 3000 });
  });
});
