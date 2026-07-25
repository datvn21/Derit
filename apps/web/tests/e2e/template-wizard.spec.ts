import path from "node:path";
import { test, expect } from "@playwright/test";
import { installPageGuards, mockBackend } from "./fixtures";

const asset = (name: string) => path.join(process.cwd(), "tests/e2e/assets", name);

test.describe("Exam template wizard", () => {
test("covers exam template wizard create/edit with upload, question files, hidden tests, preview, review, and submit", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "lecturer");

    await page.goto("/lecturer/exam-templates/create");
    await expect(page.getByRole("heading", { name: "Create exam template" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await page.locator("#templateName").fill("Wizard Unicode kỳ thi <script>alert(1)</script>");
    await page.locator("#duration").fill("75");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Codes & questions")).toBeVisible();
    await page.locator('input[type="file"][accept=".pdf"]').first().setInputFiles(asset("sample.pdf"));
    await expect(page.getByText("sample.pdf")).toBeVisible();
    await page.getByRole("button", { name: /Preview/i }).click();
    await expect(page.getByRole("dialog")).toContainText("PDF preview");
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByPlaceholder("Question title").fill("Sum two numbers");
    await page.locator('input[type="file"]').nth(1).setInputFiles(asset("Main.java"));
    await expect(page.getByText("Main.java")).toBeVisible();
    await page.getByRole("button", { name: /Entry/i }).first().click();
    await page.getByRole("button", { name: /Hidden/i }).first().click();
    await page.getByText("Main.java").click();
    await expect(page.getByRole("dialog")).toContainText("Main.java");
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByPlaceholder("e.g. 5").fill("1 2");
    await page.getByPlaceholder("e.g. 120").fill("3");
    await page.locator('input[type="file"]').nth(2).setInputFiles(asset("Test1.java"));
    await page.getByLabel("Hidden test case").check();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: /Review/i })).toBeVisible();
    await page.getByRole("button", { name: /Create template/i }).click();
    await expect(page.getByText("Template created successfully")).toBeVisible();
    await expect(page).toHaveURL(/\/lecturer\/exam-templates$/);

    await page.goto("/lecturer/exam-templates/tpl-1/edit");
    await expect(page.getByRole("heading", { name: "Edit exam template" })).toBeVisible();
    await expect(page.locator("#templateName")).toHaveValue("Java Arrays Final");
    await page.locator("#templateName").fill("Updated Wizard Template");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: /Save changes/i }).click();
    await expect(page.getByText("Template updated successfully")).toBeVisible();

    await guards.assertClean();
  });

  test("covers upload dropzone affordance and wizard validation recovery", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "lecturer");

    await page.goto("/lecturer/exam-templates/create");
    await page.locator("#templateName").fill("Drag Drop Template");
    await page.locator("#duration").fill("60");
    await page.getByRole("button", { name: "Next" }).click();

    const pdfDropzone = page.locator("div", { hasText: "Upload reference PDF" }).first();
    await pdfDropzone.dispatchEvent("dragover");
    await pdfDropzone.dispatchEvent("drop");
    await page.locator('input[type="file"][accept=".pdf"]').first().setInputFiles(asset("sample.pdf"));
    await expect(page.getByText("sample.pdf")).toBeVisible();

    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await expect(page.getByText(/title is required|Missing required/i).first()).toBeVisible();

    await page.getByPlaceholder("Question title").fill("Drag uploaded question");
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await expect(page.getByText(/Missing required/i).first()).toBeVisible();

    await guards.assertClean();
  });
});
