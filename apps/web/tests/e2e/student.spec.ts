import { test, expect } from "@playwright/test";
import { installPageGuards, mockBackend } from "./fixtures";

test.describe("Student user journeys", () => {
  test("covers dashboard rendering, search, join validation, modal, toast, nav, back/forward, refresh, and keyboard focus", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "student");

    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/student");
    await expect(page.getByRole("complementary", { name: /student navigation/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Welcome, Nguyen Van An/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Reload/i })).toBeVisible();

    await page.getByPlaceholder("Enter room code").fill("");
    await expect(page.getByRole("button", { name: /Search/i })).toBeDisabled();
    await page.getByPlaceholder("Enter room code").fill("missing");
    await page.getByRole("button", { name: /Search/i }).click();
    await expect(page.getByText(/Exam not found/i)).toBeVisible();

    await page.getByPlaceholder("Enter room code").fill("room101");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Java Midterm Room 101").last()).toBeVisible();
    await page.getByRole("button", { name: "Join Exam" }).click();
    await expect(page.getByText("Please enter the access key")).toBeVisible();
    await page.getByLabel("Access Key").fill("SECRET");
    await page.getByRole("button", { name: "Join Exam" }).click();
    await expect(page.getByText("Please enter a valid computer order number")).toBeVisible();
    await page.getByLabel("Computer Order").fill("0");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Please enter a valid computer order number")).toBeVisible();
    await page.getByLabel("Computer Order").fill("12");
    await page.getByRole("button", { name: "Join Exam" }).click();
    await expect(page.getByText(/Joined waiting list/i)).toBeVisible();

    await page.getByRole("button", { name: /Java Midterm Room 101/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("link", { name: /History/i }).click();
    await expect(page).toHaveURL(/\/student\/history$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: /My History/i })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/student$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/student\/history$/);

    await page.goto("/student");
    await expect(page.getByRole("main")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();

    await guards.assertClean();
  });
});
