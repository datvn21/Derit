import { test, expect } from "@playwright/test";
import { installPageGuards, mockBackend } from "./fixtures";

async function openExamWorkspace(page: import("@playwright/test").Page) {
  await page.goto("/student");
  await expect(page.getByRole("heading", { name: /Welcome, Nguyen Van An/i })).toBeVisible();
  await page.goto("/student/exam/session-1");
  await expect(page.getByRole("heading", { name: "Java Arrays Final" })).toBeVisible({ timeout: 15000 });
}

test.describe("Student exam workspace", () => {
test("covers exam workspace editor, file actions, autosave, run, testcase run, copy/paste/right-click tracking, drag resize, and submit", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "student");
    page.on("dialog", (dialog) => dialog.accept());

    await openExamWorkspace(page);
    await expect(page.getByText("PC 12")).toBeVisible();
    await expect(page.getByRole("button", { name: /Question 1/i })).toBeVisible();
    await expect(page.getByText("Test Cases")).toBeVisible();

    await page.getByTitle("New File").click();
    await page.getByPlaceholder("FILENAME").fill("Helper");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Helper.java").first()).toBeVisible();
    await page.locator("select").selectOption("Helper.java");
    await page.getByText("Main.java").first().click();

    const editor = page.locator(".monaco-editor").first();
    await editor.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.insertText("public class Main { public static void main(String[] args){ System.out.println(\"3\"); } }");
    await expect(page.getByText("Unsaved")).toBeVisible();
    await page.keyboard.press("Control+S");

    await page.keyboard.press("Control+C");
    await page.keyboard.press("Control+V");
    await page.mouse.click(500, 250, { button: "right" });
    await page.mouse.move(680, 300);
    await page.mouse.down();
    await page.mouse.move(760, 300);
    await page.mouse.up();

    await page.getByRole("button", { name: /Run/i }).click();
    await expect(page.locator("pre").filter({ hasText: "3" })).toBeVisible();
    await page.getByTitle("Chạy test case này").first().click();
    await expect(page.getByText("Passed 1/1")).toBeVisible();
    const questionTwoTab = page.getByRole("button", { name: /Question 2/i });
    await questionTwoTab.click();
    await expect(questionTwoTab).toBeVisible();
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Exam submitted successfully!")).toBeVisible();
    await expect(page).toHaveURL(/\/student$/);

    await guards.assertClean();
  });

  test("covers Monaco multi-file isolation, undo/redo, reset, keyboard run shortcut, and PDF toolbar", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "student");
    page.on("dialog", (dialog) => dialog.accept());

    await openExamWorkspace(page);

    await expect(page.getByTitle("Zoom out")).toBeVisible();
    await expect(page.getByTitle("Fit Width (active)")).toBeVisible();
    await page.getByTitle("Zoom in").click();
    await expect(page.getByTitle("Click to reset Fit Width")).toHaveText(/%/);
    await page.getByTitle("Zoom out").click();
    await page.getByTitle(/Fit Width|Click to reset Fit Width/).click();
    await expect(page.getByTitle("Fit Width (active)")).toBeVisible();
    await page.locator(".react-pdf__Document").scrollIntoViewIfNeeded();

    await page.getByTitle("New File").click();
    await page.getByPlaceholder("FILENAME").fill("Algorithm");
    await page.keyboard.press("Enter");
    await page.locator("select").selectOption("Algorithm.java");
    const editor = page.locator(".monaco-editor").first();
    await editor.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.insertText("public class Algorithm { static int sum(){ return 42; } }");
    await expect(page.locator(".view-line").filter({ hasText: "Algorithm" }).first()).toBeVisible();
    await page.keyboard.insertText(" markerUndo");
    await expect(page.locator(".view-line").filter({ hasText: "markerUndo" }).first()).toBeVisible();

    await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
    await expect(page.locator(".view-line").filter({ hasText: "markerUndo" })).toHaveCount(0);
    await page.keyboard.press(process.platform === "darwin" ? "Shift+Meta+Z" : "Control+Y");
    await expect(page.locator(".view-line").filter({ hasText: "markerUndo" }).first()).toBeVisible();

    await page.getByText("Main.java").first().click();
    await expect(page.locator(".view-line").filter({ hasText: "public class Main" }).first()).toBeVisible();
    await page.getByText(/Algorithm/).first().click();
    await expect(page.locator(".view-line").filter({ hasText: "return 42" }).first()).toBeVisible();

    await page.getByTitle("Reset về file gốc").click();
    await expect(page.locator(".view-line").filter({ hasText: "return 42" })).toHaveCount(0);

    await page.getByText("Main.java").first().click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
    await expect(page.locator("pre").filter({ hasText: "3" })).toBeVisible();

    await guards.assertClean();
  });
});
