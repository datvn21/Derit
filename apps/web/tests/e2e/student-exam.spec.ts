import { test, expect } from "@playwright/test";

/**
 * E2E tests for the student exam surface. These currently only validate
 * the unauthenticated redirect flow because there's no test fixture that
 * provisions a real student session. See the `verifications/characterization`
 * readme for how to enable the full student journey once a GoTrue fixture
 * exists.
 */
test.describe("Student Exam Flow", () => {
  test("redirects unauthenticated visitors away from /student", async ({ page }) => {
    const response = await page.goto("/student");
    // We accept either a 200 (rendered login) or a 3xx redirect, but the
    // final URL must not be the protected route.
    if (response) expect(response.status()).toBeLessThan(400);
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/student($|\/)/);
  });

  test("redirects unauthenticated visitors away from /student/exam/:id", async ({
    page,
  }) => {
    await page.goto("/student/exam/some-fake-id");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/student\/exam\//);
  });
});
