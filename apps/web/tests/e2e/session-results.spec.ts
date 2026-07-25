import { test, expect } from "@playwright/test";
import { installPageGuards, mockBackend } from "./fixtures";

test.describe("Exam session detail and results", () => {
test("covers session detail approvals, copy, edit, activity dialog, results search/sort/filter/export/regrade/finalize/student detail", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "lecturer");
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/lecturer/exam-sessions/session-1");
    await expect(page.getByRole("heading", { name: "Java Midterm Room 101" })).toBeVisible();
    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Room code copied to clipboard")).toBeVisible();
    await page.getByText("SECRET").locator("..").getByRole("button").click();
    await expect(page.getByText("Access key copied to clipboard")).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText("Student approved")).toBeVisible();
    await page.getByRole("button", { name: "Approve All" }).click();
    await expect(page.getByText("All waiting students approved")).toBeVisible();
    await page.getByText("12 - Nguyen Van An").click();
    await expect(page.getByRole("dialog", { name: "Nguyen Van An" })).toBeVisible();
    await expect(page.getByText("Joins: 0")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#sessionName").fill("Edited Session");
    await page.locator("#accessKey").fill("EDITKEY");
    await page.locator("#whitelist").fill("521H0001\n521H0002@student.tdtu.edu.vn");
    await page.locator("#blacklist").fill("blocked@student.tdtu.edu.vn");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Session updated successfully")).toBeVisible();

    await page.goto("/lecturer");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.goto("/lecturer/exam-sessions/session-1/results");
    await expect(page.getByRole("heading", { name: "Java Midterm Room 101" })).toBeVisible();
    await page.getByPlaceholder("Search student…").fill("nguyen");
    await expect(page.getByText("Nguyen Van An")).toBeVisible();
    await page.getByLabel("Submitted only").check();
    await page.getByRole("columnheader", { name: /Student/i }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    await download;
    await page.getByRole("button", { name: /Re-grade All/i }).click();
    await expect(page.getByText(/Re-grading/i)).toBeVisible();
    await page.getByRole("button", { name: /Finalize Results/i }).click();
    await expect(page.getByText("Results finalized successfully")).toBeVisible();
    await page.getByText("Nguyen Van An").first().click();
    await expect(page.getByText(/Exam Code/i)).toBeVisible();
    await page.getByRole("button", { name: /Tải bài/i }).click();

    await guards.assertClean();
  });
});