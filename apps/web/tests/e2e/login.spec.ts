import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/");
    
    // Should show login button or redirect
    const loginButton = page.getByRole("button", { name: /sign in with google/i });
    await expect(loginButton.or(page.getByText(/welcome/i))).toBeVisible();
  });

  test("should redirect to login when accessing protected route", async ({ page }) => {
    await page.goto("/student");
    
    // Should redirect to login or show appropriate UI
    await expect(page).not.toHaveURL(/\/student/);
  });

  test("should redirect to login when accessing lecturer route", async ({ page }) => {
    await page.goto("/lecturer");
    
    // Should redirect to login or show appropriate UI
    await expect(page).not.toHaveURL(/\/lecturer/);
  });
});
