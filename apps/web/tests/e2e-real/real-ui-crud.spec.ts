import { test, expect } from "@playwright/test";
import { apiBase, loadServerEnv, loginAs, seedRealBackend } from "./helpers";

loadServerEnv();

test.describe("Real backend UI CRUD", () => {
  test("performs classroom create, edit, search, and delete through the lecturer UI", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "lecturer");

    await page.goto("/lecturer/classrooms");
    await expect(page.getByRole("heading", { name: "Classrooms" })).toBeVisible();
    await page.getByRole("button", { name: /Create Classroom/i }).click();
    await expect(page).toHaveURL(/\/lecturer\/classrooms\/create$/);

    await page.locator("main button").nth(1).click();
    await expect(page.getByText("Please enter a classroom name")).toBeVisible();
    await page.locator("#classroomName").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.press("Backspace");
    await page.locator("#classroomName").pressSequentially("E2E UI Classroom Unicode ky thi <script>alert(1)</script>");
    await page.locator("#students").click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.press("Backspace");
    await page.locator("#students").pressSequentially("531H0001\n\n531H0002\nunicode.student");
    await expect(page.getByText("3 students")).toBeVisible();
    const createResponse = page.waitForResponse(
      (response) => response.url() === `${apiBase}/classrooms` && response.request().method() === "POST",
    );
    await page.locator("main button").nth(1).click({ force: true });
    expect((await createResponse).status()).toBe(201);
    await expect(page.getByText("Classroom created successfully!")).toBeVisible();
    await expect(page).toHaveURL(/\/lecturer\/classrooms$/);

    await page.getByPlaceholder("Search classrooms...").fill("Unicode");
    await expect(page.getByText("E2E UI Classroom Unicode ky thi")).toBeVisible();
    const card = page.locator("div").filter({ hasText: "E2E UI Classroom Unicode ky thi" }).first();
    await card.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit Classroom" })).toBeVisible();
    await page.locator("#classroomName").fill("E2E UI Classroom Updated");
    await page.locator("#students").fill("531H9999");
    await expect(page.getByText("1 student")).toBeVisible();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Classroom updated successfully!")).toBeVisible();

    await page.getByPlaceholder("Search classrooms...").fill("Updated");
    const updatedCard = page.locator("div").filter({ hasText: "E2E UI Classroom Updated" }).first();
    page.once("dialog", (dialog) => dialog.accept());
    await updatedCard.getByRole("button").last().click();
    await expect(page.getByText("Classroom deleted successfully")).toBeVisible();
    await expect(page.getByText("E2E UI Classroom Updated")).toHaveCount(0);
  });

  test("performs admin user create, edit, search, and delete through the admin UI", async ({ page, request }) => {
    await seedRealBackend(request);
    await loginAs(page, "admin");

    const unique = Date.now();
    const email = `e2e.ui.${unique}@tdtu.edu.vn`;
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await page.getByRole("button", { name: /Create User/i }).click();
    await expect(page.getByRole("dialog")).toContainText("Create New User");
    await page.locator("#email").fill(email);
    await page.locator("#name").fill("E2E UI Lecturer");
    await page.getByRole("button", { name: "Create User" }).click();
    await expect(page.getByText("User created successfully")).toBeVisible();

    await page.getByPlaceholder(/Search by name/i).fill(email);
    await expect(page.getByRole("table")).toContainText(email);
    const row = page.getByRole("row").filter({ hasText: email });
    await row.getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toContainText("Edit User");
    await page.locator("#edit-name").fill("E2E UI Lecturer Updated");
    await page.locator("#edit-active").uncheck();
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("User updated successfully")).toBeVisible();

    await page.getByPlaceholder(/Search by name/i).fill(email);
    const updatedRow = page.getByRole("row").filter({ hasText: email });
    await updatedRow.getByRole("button").last().click();
    await expect(page.getByRole("dialog")).toContainText("Delete User");
    await page.getByRole("button", { name: "Delete User" }).click();
    await expect(page.getByText("User deleted successfully")).toBeVisible();
    const deletedSearch = await page.request.get(`${apiBase}/admin/users?search=${encodeURIComponent(email)}`);
    await expect(deletedSearch).toBeOK();
    expect((await deletedSearch.json()).users).toEqual([]);
  });
});
