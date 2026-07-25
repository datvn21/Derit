import { test, expect } from "@playwright/test";
import { installPageGuards, mockBackend } from "./fixtures";

test.describe("Public routing and auth boundaries", () => {
  test("renders login, setup copy, OAuth action, query errors, and 404", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, null);

    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Derit/i);
    await expect(page.getByRole("heading", { name: "DERIT" })).toBeVisible();
    await expect(page.getByText("First time setup detected")).toBeVisible();
    await expect(page.getByText(/student\.tdtu\.edu\.vn/)).toBeVisible();

    await page.goto("/?error=invalid_email");
    await expect(page.getByText(/Invalid email/i)).toBeVisible();
    await page.goto("/?error=server_error");
    await expect(page.getByText(/Server error/i)).toBeVisible();

    await page.goto("/does-not-exist");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText(/could not be found/i)).toBeVisible();

    await guards.assertClean();
  });

  test("redirects protected role routes when unauthenticated", async ({ page }) => {
    await mockBackend(page, null);
    for (const path of ["/student", "/student/history", "/lecturer", "/admin"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/$/);
    }

    await page.goto("/student/exam/session-1");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("main")).toHaveCount(0);
  });
});
