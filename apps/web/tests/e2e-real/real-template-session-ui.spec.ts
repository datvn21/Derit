import { test, expect } from "@playwright/test";
import { apiBase, loadServerEnv, loginAs, seedRealBackend } from "./helpers";

loadServerEnv();

function localDateTime(minutesFromNow: number) {
  const d = new Date(Date.now() + minutesFromNow * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe("Real template and session UI flows", () => {
  test("covers template share and delete dialogs through the lecturer UI", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "lecturer");

    const create = await page.request.post(`${apiBase}/exam-templates`, {
      data: {
        templateName: "E2E UI Delete Template",
        examType: "OOP",
        language: "java",
        duration: 30,
        examCodes: [
          {
            codeNumber: "1",
            pdfUrl: "/uploads/e2e-sample.pdf",
            questions: [{ questionNumber: 1, title: "Delete me", testCases: [] }],
          },
        ],
      },
    });
    await expect(create).toBeOK();

    await page.goto("/lecturer/exam-templates");
    await expect(page.getByText("E2E Java Arrays Final")).toBeVisible();
    await page.locator("div").filter({ hasText: "E2E Java Arrays Final" }).first()
      .getByLabel(/Share E2E Java Arrays Final/i).click();
    await expect(page.getByRole("dialog")).toContainText("Share Template");
    await page.getByLabel("Recipient Email").fill("e2e.lecturer@tdtu.edu.vn");
    await page.getByRole("button", { name: /^Share$/ }).click();
    await expect(page.getByText(/cannot share|Template shared|No user/i).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByPlaceholder("Search templates...").fill("Delete Template");
    const card = page.locator("div").filter({ hasText: "E2E UI Delete Template" }).first();
    await card.getByLabel(/Delete E2E UI Delete Template/i).click();
    await expect(page.getByRole("dialog")).toContainText("Delete Template");
    await page.getByRole("button", { name: "Cancel" }).click();
    await card.getByLabel(/Delete E2E UI Delete Template/i).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Template deleted successfully")).toBeVisible();
  });

  test("covers exam session create, start, and end controls through the lecturer UI", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "lecturer");

    await page.goto("/lecturer/exam-sessions/create");
    await expect(page.getByRole("heading", { name: "Create Exam Session" })).toBeVisible();
    await page.getByRole("button", { name: "Create Session" }).click();
    await expect(page.getByText("Please select an exam template")).toBeVisible();

    await page.getByRole("combobox").first().click();
    await page.getByText("E2E Java Arrays Final").last().click();
    await page.locator("#sessionName").fill("E2E UI Scheduled Session");
    await page.locator("#startTime").fill(localDateTime(30));
    await page.locator("#endTime").fill(localDateTime(90));
    await page.locator("#accessKey").fill("UISTART");
    await page.locator("#whitelist").fill("e2e.student@student.tdtu.edu.vn");
    const createResponse = page.waitForResponse(
      (response) => response.url() === `${apiBase}/exam-sessions` && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create Session" }).click();
    expect((await createResponse).status()).toBe(201);
    await expect(page.getByText(/Exam session created/i)).toBeVisible();
    await expect(page).toHaveURL(/\/lecturer\/exam-sessions$/);

    await page.getByPlaceholder("Search sessions...").fill("E2E UI Scheduled Session");
    const card = page.locator("div").filter({ hasText: "E2E UI Scheduled Session" }).first();
    await card.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Session started")).toBeVisible();
    await expect(card.getByRole("button", { name: "End" })).toBeVisible();
    await card.getByRole("button", { name: "End" }).click();
    await expect(page.getByRole("dialog")).toContainText("End Session");
    await page.getByRole("button", { name: /^End Session$/ }).click();
    await expect(page.getByText("Session ended")).toBeVisible();
  });
});
