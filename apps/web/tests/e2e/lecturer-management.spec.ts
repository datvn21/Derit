import { test, expect } from "@playwright/test";
import { installPageGuards, mockBackend } from "./fixtures";

test.describe("Lecturer management journeys", () => {
  test("covers sidebar routing and template search/share/delete dialogs", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "lecturer");

    await page.goto("/lecturer");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("link", { name: /Manage templates/i }).click();
    await expect(page).toHaveURL(/\/lecturer\/exam-templates$/);

    await page.getByPlaceholder("Search templates...").fill("python");
    await expect(page.getByText("Python Strings")).toBeVisible();
    await expect(page.getByText("Java Arrays Final")).toBeHidden();
    await page.getByPlaceholder("Search templates...").fill("missing");
    await expect(page.getByText("No templates found")).toBeVisible();
    await page.getByPlaceholder("Search templates...").fill("");

    await page.getByTitle("Share template").first().click();
    await expect(page.getByRole("dialog")).toContainText("Share Template");
    await expect(page.getByRole("button", { name: /Share/i })).toBeDisabled();
    await page.getByLabel("Recipient Email").fill("giang.vien+test@tdtu.edu.vn");
    await page.getByRole("button", { name: /^Share$/ }).click();
    await expect(page.getByText(/Template shared successfully/i)).toBeVisible();

    await page.locator("div", { hasText: "Java Arrays Final" }).first().locator("button").last().click();
    await expect(page.getByRole("dialog")).toContainText("Delete Template");
    await page.getByRole("button", { name: "Cancel" }).click();

    await guards.assertClean();
  });

  test("covers classroom search, create validation, form preview, and edit form", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "lecturer");

    await page.goto("/lecturer/classrooms");
    await expect(page.getByRole("heading", { name: "Classrooms" })).toBeVisible();
    await page.getByRole("link", { name: /Classrooms/i }).click();
    await expect(page.getByRole("heading", { name: "Classrooms" })).toBeVisible();
    await page.getByPlaceholder("Search classrooms...").fill("nhom viet");
    await expect(page.getByText("K22 DSA - Nhom Viet")).toBeVisible();
    await expect(page.getByText("K21 OOP - Group A")).toBeHidden();
    await page.getByPlaceholder("Search classrooms...").fill("zzz");
    await expect(page.getByText("No classrooms found")).toBeVisible();

    await page.getByRole("button", { name: /Create Classroom/i }).click();
    await expect(page).toHaveURL(/\/lecturer\/classrooms\/create$/);
    await page.getByRole("main").getByRole("button", { name: /^Create Classroom$/ }).first().click();
    await expect(page.getByText("Please enter a classroom name")).toBeVisible();
    await page.locator("#classroomName").fill("Lop K23 Tieng Viet <script>alert(1)</script>");
    await page.locator("#students").fill("523H0001\n   \n523H0002\nNguyen Van A");
    await expect(page.getByText("3 students")).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/lecturer\/classrooms$/);

    await page.goto("/lecturer/classrooms/class-1/edit");
    await expect(page.getByRole("heading", { name: "Edit Classroom" })).toBeVisible();
    await expect(page.locator("#classroomName")).toHaveValue("K21 OOP - Group A");
    await page.locator("#classroomName").fill("Updated K21");
    await page.locator("#students").fill("521H0001\n521H9999");
    await expect(page.getByText("2 students")).toBeVisible();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page).toHaveURL(/\/lecturer\/classrooms$/);

    await guards.assertClean();
  });

  test("covers exam session list, start/end controls, create validation, detail, and results route", async ({ page }) => {
    const guards = installPageGuards(page);
    await mockBackend(page, "lecturer");

    await page.goto("/lecturer/exam-sessions");
    await expect(page.getByRole("heading", { name: "Exam Sessions" })).toBeVisible();
    await page.getByPlaceholder("Search sessions...").fill("room101");
    await expect(page.getByText("Java Midterm Room 101")).toBeVisible();
    await page.getByPlaceholder("Search sessions...").fill("absent");
    await expect(page.getByText("Java Midterm Room 101")).toBeHidden();
    await page.getByPlaceholder("Search sessions...").fill("");

    await page.locator("div", { hasText: "Java Midterm Room 101" }).first().getByRole("button", { name: "End" }).click();
    await expect(page.getByRole("dialog")).toContainText("End Session");
    await page.getByRole("button", { name: /^End Session$/ }).click();
    await expect(page.getByText("Session ended")).toBeVisible();

    await page.getByRole("button", { name: "Details" }).first().click();
    await expect(page).toHaveURL(/\/lecturer\/exam-sessions\/session-1$/);
    await expect(page.getByRole("heading", { name: /Java Midterm Room 101/i })).toBeVisible();
    await page.goto("/lecturer/exam-sessions/session-1/results");
    await expect(page).toHaveURL(/\/lecturer\/exam-sessions\/session-1\/results$/);
    await expect(page.getByRole("heading", { name: /Java Midterm Room 101/i })).toBeVisible();

    await page.goto("/lecturer/exam-sessions/create");
    await expect(page.getByRole("heading", { name: "Create Exam Session" })).toBeVisible();
    await page.getByRole("combobox").first().click();
    await expect(page.getByText("Java Arrays Final").last()).toBeVisible();
    await page.getByText("Java Arrays Final").last().click();
    await page.locator("#sessionName").fill("Vietnamese unicode kỳ thi SQL ' OR 1=1 --");
    await page.locator("#startTime").fill("2026-07-25T09:00");
    await page.locator("#endTime").fill("2026-07-25T10:30");
    await page.locator("#accessKey").fill("KEY-123");
    const createSessionRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes("localhost:5001/exam-sessions"),
    );
    await page.getByRole("main").getByRole("button", { name: /^Create Session$/ }).first().click();
    await createSessionRequest;
    await expect(page).toHaveURL(/\/lecturer\/exam-sessions$/);

    await guards.assertClean();
  });
});
