import { test, expect } from "@playwright/test";
import path from "node:path";
import { loadServerEnv, loginAs, repoRoot, seedRealBackend } from "./helpers";

loadServerEnv();

const asset = (name: string) => path.join(repoRoot, "apps/web/tests/e2e/assets", name);

test.describe("Real template wizard UI", () => {
  test("creates and edits a template with PDF upload, preview, files, hidden testcase, review, and submit", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "lecturer");

    await page.goto("/lecturer/exam-templates/create");
    await expect(page.getByRole("heading", { name: "Create exam template" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await page.locator("#templateName").fill("E2E Wizard Unicode ky thi <script>alert(1)</script>");
    await page.locator("#duration").fill("75");
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Codes & questions")).toBeVisible();
    await page.locator('input[type="file"][accept=".pdf"]').first().setInputFiles(asset("sample.pdf"));
    await expect(page.getByText("sample.pdf")).toBeVisible();
    await page.getByRole("button", { name: /Preview/i }).click();
    await expect(page.getByRole("dialog")).toContainText("PDF preview");
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByPlaceholder("Question title").fill("Sum two numbers real");
    await page.locator('input[type="file"]').nth(1).setInputFiles(asset("Main.java"));
    await expect(page.getByText("Main.java")).toBeVisible();
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
    await expect(page.getByText("Template created successfully")).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(/\/lecturer\/exam-templates$/);
    await expect(page.getByText("E2E Wizard Unicode ky thi")).toBeVisible();

    await page.getByPlaceholder("Search templates...").fill("E2E Wizard Unicode");
    const card = page.locator("div").filter({ hasText: "E2E Wizard Unicode ky thi" }).first();
    await card.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit exam template" })).toBeVisible();
    await page.locator("#templateName").fill("E2E Wizard Updated");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: /Save changes/i }).click();
    await expect(page.getByText("Template updated successfully")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("E2E Wizard Updated")).toBeVisible();
  });
});
