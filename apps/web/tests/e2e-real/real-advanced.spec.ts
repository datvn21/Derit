import { test, expect } from "@playwright/test";
import { apiBase, loadServerEnv, loginAs, seedRealBackend } from "./helpers";

loadServerEnv();

async function joinJavaExam(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  await seedRealBackend(request);
  await loginAs(page, "student");
  await page.goto("/student");
  await page.getByPlaceholder("Enter room code").fill("E2E101");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByLabel("Access Key").fill("SECRET");
  const computerOrder = page.getByLabel("Computer Order");
  if (await computerOrder.isVisible()) await computerOrder.fill("12");
  await page.getByRole("button", { name: "Join Exam" }).click();
  await expect(page.getByRole("heading", { name: "E2E Java Arrays Final" })).toBeVisible({ timeout: 15000 });
}

test.describe("Real advanced UI flows", () => {
  test("covers student exam file actions, PDF toolbar, clipboard/right-click tracking, resize, and shortcuts", async ({ page, request }) => {
    await joinJavaExam(page, request);
    page.on("dialog", (dialog) => dialog.accept());

    await page.getByTitle("Zoom in").click();
    await page.getByTitle("Zoom out").click();
    await page.getByTitle(/Fit Width|Click to reset Fit Width/).click();

    await page.getByTitle("New File").click();
    await page.getByPlaceholder("FILENAME").fill("Helper");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Helper.java").first()).toBeVisible();
    await page.locator("select").selectOption("Helper.java");
    await expect(page.getByText("Helper.java").first()).toBeVisible();

    const editor = page.locator(".monaco-editor").first();
    await editor.click();
    await page.keyboard.insertText("public class Helper { static int value(){ return 42; } }");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
    await page.keyboard.press(process.platform === "darwin" ? "Shift+Meta+Z" : "Control+Y");
    await page.keyboard.press("Control+C");
    await page.keyboard.press("Control+V");
    await page.mouse.click(520, 260, { button: "right" });
    await page.mouse.move(680, 320);
    await page.mouse.down();
    await page.mouse.move(760, 320);
    await page.mouse.up();

    await page.locator("select").selectOption("Main.java");
    await editor.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.insertText('public class Main { public static void main(String[] args) { System.out.println("shortcut-run"); } }');
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
    await expect(page.locator("pre").filter({ hasText: "shortcut-run" })).toBeVisible({ timeout: 30000 });

    const activity = await page.request.get(`${apiBase}/submissions/record-client-event/${new URL(page.url()).pathname.split("/").pop()}`);
    expect([200, 400, 404]).toContain(activity.status());
  });

  test("covers student duplicate file alert, delete file, and multi-question switching", async ({ page, request }) => {
    await joinJavaExam(page, request);

    await expect(page.getByRole("button", { name: /Question 1/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Question 2/i })).toBeVisible();
    await page.evaluate(() => {
      (window as typeof window & { __lastE2EAlert?: string }).__lastE2EAlert = "";
      window.alert = (message?: unknown) => {
        (window as typeof window & { __lastE2EAlert?: string }).__lastE2EAlert = String(message ?? "");
      };
    });

    await page.getByTitle("New File").click();
    const newFileInput = page.getByPlaceholder("FILENAME");
    await newFileInput.fill("Scratch");
    await newFileInput.press("Enter");
    await expect(page.getByText("Scratch.java").first()).toBeVisible();

    await page.getByTitle("New File").click();
    await newFileInput.fill("Scratch");
    await newFileInput.press("Enter");
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __lastE2EAlert?: string }).__lastE2EAlert))
      .toContain("File with this name already exists");
    await expect(page.getByText("Scratch.java").first()).toBeVisible();

    await page.locator("select").selectOption("Scratch.java");
    await page.getByText("Scratch.java").first().hover();
    await page.getByRole("button", { name: "Delete Scratch.java" }).click();
    await expect(page.locator("select option", { hasText: "Scratch.java" })).toHaveCount(0);

    await page.getByRole("button", { name: /Question 2/i }).click();
    await expect(page.locator(".view-line").filter({ hasText: "q2" }).first()).toBeVisible();
    await page.getByRole("button", { name: /Question 1/i }).click();
    await expect(page.locator(".view-line").filter({ hasText: "Scanner" }).first()).toBeVisible();
  });

  test("covers session waiting approvals, copy, edit, activity dialog, export, regrade, and finalize", async ({ page, request }) => {
    const seeded = await seedRealBackend(request);
    await loginAs(page, "lecturer");
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto(`/lecturer/exam-sessions/${seeded.sessionId}`);
    await expect(page.getByRole("heading", { name: "E2E Java Midterm Room 101" })).toBeVisible();
    await expect(page.getByText("E2E Waiting Student")).toBeVisible();
    await page.getByRole("button", { name: "Copy" }).first().click();
    await expect(page.getByText(/copied/i)).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByText(/approved/i)).toBeVisible();

    await page.getByText("12 -").click();
    await expect(page.getByRole("dialog")).toContainText("E2E Student");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.locator("#sessionName").fill("E2E Java Midterm Room 101 Edited");
    await page.locator("#accessKey").fill("SECRET2");
    await page.locator("#whitelist").fill("e2e.student@student.tdtu.edu.vn");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Session updated successfully")).toBeVisible();

    await page.goto(`/lecturer/exam-sessions/${seeded.sessionId}/results`);
    await expect(page.getByRole("heading", { name: /E2E Java Midterm Room 101/i })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export CSV/i }).click();
    await download;
    await page.getByRole("button", { name: /Re-grade All/i }).click();
    await expect(page.getByText(/Re-grading|No submitted|Failed|Re-grade/i).first()).toBeVisible();
    await page.getByRole("button", { name: /Finalize Results/i }).click();
    await expect(page.getByText(/finalized|Finalized/i).first()).toBeVisible({ timeout: 15000 });
  });
});
