import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/");

    // The login screen must always offer a Google sign-in entry point.
    // The rendered label is "Login with Google" — match case-insensitively
    // so this stays stable across copy edits.
    const loginButton = page.getByRole("button", {
      name: /log ?in with google/i,
    });
    await expect(loginButton).toBeVisible({ timeout: 5000 });
  });

  test("redirects /student to root when unauthenticated", async ({ page }) => {
    await page.goto("/student");
    await page.waitForLoadState("networkidle");

    // The auth shell should kick the user back to the login page at `/`.
    await expect(page).toHaveURL(/\/$/);
  });

  test("redirects /lecturer to root when unauthenticated", async ({ page }) => {
    await page.goto("/lecturer");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/$/);
  });
});
